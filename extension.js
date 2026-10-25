const vscode = require('vscode');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const pkg = require('./package.json');

// Identifier of this extension as the manager of the CMake Kits entries it generates
const kitsManager = 'fougas.msys2';

function normalizePath(p) {
	return p ? p.replace(/\\/g, '/') : '';
}

// Kit name matchers in the order of precedence; the first matching one identifies the toolchain environment in effect
const kitMatchers = [
	[/ucrt\s*64/i, 'ucrt64'],
	[/clang\s*64/i, 'clang64'],
	[/clang\s*32/i, 'clang32'],
	[/mingw\s*64/i, 'mingw64'],
	[/mingw\s*32/i, 'mingw32'],
	[/cygwin\s*64/i, 'cygwin64'],
	[/cygwin(\s*32)?/i, 'cygwin32'],
	[/msys2?/i, 'msys2']
];

// Return canonic name of buildkit in effect or null if it is unrecognized
function BuildKit() {
	return vscode.commands.executeCommand('cmake.buildKit').then(kit => {
		if(!kit) return null;
		const match = kitMatchers.find(([pattern]) => pattern.test(kit));
		return match ? match[1] : null;
	});
}

// Return executable path for the buildkit in effect
// Falls back to the bare executable name if the buildkit is unrecognized or its environment provides no such tool, e.g. MPI under Cygwin
function BuildKitExe(exe, fallback = null) {
	const bare = fallback ? fallback : exe;
	return BuildKit().then(kit => {
		return (kit && exe in environments[kit].tools) ? vscode.commands.executeCommand(`${kit}.${exe}.exe`) : bare;
	});
}

// Return MinGW location provider or null if the mingw??.root is set explicitly
function MinGWProvider(bit) {
	return vscode.workspace.getConfiguration().get(`mingw${bit}.root`) ? null : vscode.workspace.getConfiguration().get(`mingw${bit}.provider`);
}

// Return executable name of a MinGW tool depending on whether the toolchain is hosted by Cygwin
function mingwExe(bit, cygwinName, nativeName) {
	return /cygwin.*/i.test(MinGWProvider(bit)) ? cygwinName : nativeName;
}

// Return root directory of the MinGW toolchain: the explicit mingw??.root if set, otherwise the one implied by the provider
function mingwRoot(bit) {
	const explicit = normalizePath(vscode.workspace.getConfiguration().get(`mingw${bit}.root`));
	if(explicit) return explicit;
	const prov = vscode.workspace.getConfiguration().get(`mingw${bit}.provider`);
	switch(prov) {
		case 'cygwin32': case 'cygwin64': return rootOf(prov);
		default: return `${rootOf('msys2')}/mingw${bit}`; // msys2 being the default provider, this also covers unrecognized values
	}
}

// Return root directory of a toolchain environment as its {name}.root command does
function rootOf(name) {
	return environments[name].root();
}

// Executable names of the tools shared by all the toolchain environments
const commonTools = {
	gdb: 'gdb.exe',
	cmake: 'cmake.exe',
	meson: 'meson.exe'
};

// Executable names of the GNU compiler suite
const gnuTools = {
	make: 'make.exe',
	ninja: 'ninja.exe',
	cc: 'gcc.exe',
	cxx: 'g++.exe',
	fc: 'gfortran.exe'
};

// Executable names of the MPI compiler drivers
const mpiTools = {
	mpicc: 'mpicc.exe',
	mpicxx: 'mpicxx.exe',
	mpifort: 'mpifort.exe'
};

// Cygwin-hosted toolchain environment with its own GNU compiler suite and no MPI support
function cygwinEnv(bit) {
	return {
		kit: `Cygwin${bit}`,
		kitGenerator: 'Unix Makefiles',
		bin: 'bin',
		root: () => normalizePath(vscode.workspace.getConfiguration().get(`cygwin${bit}.root`)),
		tools: { bash: 'bash.exe', ...commonTools, ...gnuTools }
	};
}

// MinGW toolchain environment: provided by MSYS2 by default or by Cygwin with cross-prefixed tools, or a standalone one
function mingwEnv(bit) {
	const prefix = `${bit == 32 ? 'i686' : 'x86_64'}-w64-mingw32`;
	return {
		kit: `MinGW${bit}`,
		kitGenerator: 'MinGW Makefiles',
		kitMPI: true,
		bin: 'bin',
		root: () => mingwRoot(bit),
		tools: {
			...commonTools,
			...gnuTools,
			...mpiTools,
			make: bin => `${bin}/${mingwExe(bit, 'make.exe', 'mingw32-make.exe')}`,
			cc: bin => `${bin}/${mingwExe(bit, `${prefix}-gcc.exe`, 'gcc.exe')}`,
			cxx: bin => `${bin}/${mingwExe(bit, `${prefix}-g++.exe`, 'g++.exe')}`,
			fc: bin => `${bin}/${mingwExe(bit, `${prefix}-gfortran.exe`, 'gfortran.exe')}`
		}
	};
}

// MSYS2-hosted Clang toolchain environment
function clangEnv(dir) {
	return {
		kit: `Clang${dir}`,
		kitGenerator: 'MinGW Makefiles',
		kitMPI: true,
		bin: 'bin',
		root: () => `${rootOf('msys2')}/clang${dir}`,
		tools: {
			...commonTools,
			...gnuTools,
			...mpiTools,
			make: 'mingw32-make.exe',
			cc: 'clang.exe',
			cxx: 'clang++.exe',
			fc: 'flang.exe'
		}
	};
}

// Toolchain environments; a tool entry is either an executable name within the bin directory or a function of it
const environments = {
	msys2: {
		kit: 'MSYS2',
		kitGenerator: 'Unix Makefiles',
		bin: 'usr/bin',
		root: () => normalizePath(vscode.workspace.getConfiguration().get('msys2.root')),
		tools: { bash: 'bash.exe', ...commonTools, ...gnuTools, ...mpiTools }
	},
	cygwin32: cygwinEnv(32),
	cygwin64: cygwinEnv(64),
	mingw32: mingwEnv(32),
	mingw64: mingwEnv(64),
	clang32: clangEnv(32),
	clang64: clangEnv(64),
	ucrt64: {
		kit: 'UCRT64',
		kitGenerator: 'MinGW Makefiles',
		kitMPI: true,
		bin: 'bin',
		root: () => `${rootOf('msys2')}/ucrt64`,
		tools: { ...commonTools, ...gnuTools, ...mpiTools, make: 'mingw32-make.exe' }
	}
};

// Tools retrievable for the buildkit in effect
const buildkitTools = ['cmake', 'meson', 'ninja', 'make', 'gdb', 'cc', 'cxx', 'fc', 'mpicc', 'mpicxx', 'mpifort'];

// Register a command deferring its disposable to the extension lifetime subscriptions
function registerCommand(subscriptions, name, handler) {
	subscriptions.push(vscode.commands.registerCommand(name, handler));
}

// Register the root, bin, path and tool executable retrievers of a single toolchain environment
function registerEnvironment(subscriptions, name, env, pathSeparator, systemPath) {
	registerCommand(subscriptions, `${name}.root`, function () {
		return env.root();
	});

	registerCommand(subscriptions, `${name}.bin`, function () {
		return `${env.root()}/${env.bin}`;
	});

	registerCommand(subscriptions, `${name}.path`, function () {
		return `${env.root()}/${env.bin}${pathSeparator}${systemPath}`;
	});

	for(const [tool, exe] of Object.entries(env.tools)) {
		registerCommand(subscriptions, `${name}.${tool}.exe`, function () {
			const bin = `${env.root()}/${env.bin}`;
			return typeof exe == 'function' ? exe(bin) : `${bin}/${exe}`;
		});
	}
}

// Register the buildkit-generic retrievers delegating to the environment-specific ones
function registerBuildKitCommands(subscriptions, pathSeparator, systemPath) {

	// Return buildkit-specific value or null if the buildkit is unrecognized
	const kitValue = suffix => BuildKit().then(kit => {
		return kit ? vscode.commands.executeCommand(`${kit}.${suffix}`) : null;
	});

	registerCommand(subscriptions, 'cmake.buildkit.bin', function () {
		return kitValue('bin');
	});

	registerCommand(subscriptions, 'cmake.buildkit.path', function () {
		return kitValue('path');
	});

	// System-specific value of the PATH environment variable for the launch tasks
	registerCommand(subscriptions, 'cmake.buildkit.launch.path', function () {
		return vscode.commands.executeCommand('cmake.buildkit.path').then(path => {
			return vscode.commands.executeCommand('cmake.getLaunchTargetDirectory').then(targetDir => {
				return `${targetDir}${pathSeparator}${path || systemPath}`; // without a recognized buildkit, degrade to the plain system PATH
			});
		});
	});

	registerCommand(subscriptions, 'cmake.buildkit.generator.exe', function () {
		const gtor = vscode.workspace.getConfiguration().get('cmake.generator');
		if(/Ninja.*/.test(gtor)) return BuildKitExe('ninja');
		return BuildKitExe('make'); // the Makefiles generators as well as unset and unrecognized ones; TODO more elaborate make tool selection taking the build kit name into account
	});

	for(const tool of buildkitTools) {
		registerCommand(subscriptions, `cmake.buildkit.${tool}.exe`, function () {
			return BuildKitExe(tool);
		});
	}
}

// Toolchain environments in the order their CMake Kits are injected
const kitOrder = ['mingw32', 'mingw64', 'ucrt64', 'clang32', 'clang64', 'msys2', 'cygwin32', 'cygwin64'];

// Compose the extension-managed CMake Kits entries; the manager property marks the ownership
function cmakeKits() {
	return kitOrder.map(name => {
		const env = environments[name];
		const settings = {
			CMAKE_C_COMPILER: `\${command:${name}.cc.exe}`,
			CMAKE_CXX_COMPILER: `\${command:${name}.cxx.exe}`,
			CMAKE_Fortran_COMPILER: `\${command:${name}.fc.exe}`
		};
		if(env.kitMPI) {
			settings.MPI_C_COMPILER = `\${command:${name}.mpicc.exe}`;
			settings.MPI_CXX_COMPILER = `\${command:${name}.mpicxx.exe}`;
			settings.MPI_Fortran_COMPILER = `\${command:${name}.mpifort.exe}`;
		}
		return {
			name: env.kit,
			preferredGenerator: {name: env.kitGenerator},
			environmentVariables: {PATH: `\${command:${name}.path}`},
			cmakeSettings: settings,
			keep: true,
			manager: kitsManager
		};
	});
}

// Check whether a kit entry is owned by this extension: either explicitly marked or bearing one of the managed names
function isManagedKit(kit, managedNames) {
	return kit.manager === kitsManager || managedNames.has(kit.name);
}

// Merge the extension-managed kits into the existing ones, replacing the same-named entries and keeping the foreign ones intact
function mergeKits(existing) {
	const managedNames = new Set(cmakeKits().map(kit => kit.name));
	return [...existing.filter(kit => !isManagedKit(kit, managedNames)), ...cmakeKits()];
}

// Strip the extension-managed kits from the existing entries keeping the foreign ones intact
function removeKits(existing) {
	const managedNames = new Set(cmakeKits().map(kit => kit.name));
	return existing.filter(kit => !isManagedKit(kit, managedNames));
}

// Inject or remove the extension-managed kits in a cmake-kits.json descriptor, creating it as needed
async function updateKitsFile(file, inject) {
	let existing = [];
	let existed = true;
	try {
		const text = await fs.readFile(file, 'utf8');
		if(text.trim()) existing = JSON.parse(text);
	} catch(err) {
		if(err.code != 'ENOENT') throw new Error(`cannot parse ${file}: ${err.message}`);
		existed = false;
	}
	const updated = inject ? mergeKits(existing) : removeKits(existing);
	if(!updated.length && !existed && !inject) return {file, count: 0}; // nothing to remove, keep the missing descriptor as is
	await fs.mkdir(path.dirname(file), {recursive: true});
	await fs.writeFile(file, JSON.stringify(updated, null, 2) + '\n');
	return {file, count: inject ? cmakeKits().length : existing.length - updated.length};
}

// VS Code user configuration folder name, e.g. Code, Code - Insiders, VSCodium
function appConfigFolder() {
	const app = vscode.env.appName || '';
	if(/insiders/i.test(app)) return 'Code - Insiders';
	if(/codium/i.test(app)) return 'VSCodium';
	return 'Code';
}

// Location of the user-local cmake-kits.json descriptor used by the CMakeTools
function userKitsFile() {
	const appData = process.env.VSCODE_PORTABLE_USER_DATA
		|| (process.platform == 'win32'
			? process.env.APPDATA
			: path.join(os.homedir(), process.platform == 'darwin' ? 'Library/Application Support' : '.config'));
	return path.join(appData, appConfigFolder(), 'User', 'cmake-kits.json');
}

// Location of the per-project cmake-kits.json descriptor of the primary workspace folder
function projectKitsFile() {
	const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
	return folder ? path.join(folder.uri.fsPath, '.vscode', 'cmake-kits.json') : null;
}

// Register the commands injecting and removing the extension-managed CMake Kits
function registerKitsCommands(subscriptions) {
	registerCommand(subscriptions, 'msys2.kits.inject.user', () => runDescriptorUpdate(userKitsFile(), true, updateKitsFile, 'CMake Kits'));
	registerCommand(subscriptions, 'msys2.kits.remove.user', () => runDescriptorUpdate(userKitsFile(), false, updateKitsFile, 'CMake Kits'));
	registerCommand(subscriptions, 'msys2.kits.inject.project', () => runDescriptorUpdate(projectKitsFile(), true, updateKitsFile, 'CMake Kits'));
	registerCommand(subscriptions, 'msys2.kits.remove.project', () => runDescriptorUpdate(projectKitsFile(), false, updateKitsFile, 'CMake Kits'));
}

// Names of the CMake presets owned by this extension: the canonical ones plus those recorded in the vendor field of the descriptor
function managedPresetNames(existing) {
	const recorded = (existing.vendor && existing.vendor[kitsManager] && existing.vendor[kitsManager].presets) || [];
	return new Set([...kitOrder, ...recorded]);
}

// Compose the extension-managed CMake Presets with the toolchain paths resolved to their current values
async function cmakePresets() {
	const generator = vscode.workspace.getConfiguration().get('msys2.presets.generator') || 'Ninja';
	const makeTool = /Ninja/i.test(generator) ? 'ninja' : 'make';
	const configurePresets = [], buildPresets = [];
	for(const name of kitOrder) {
		const env = environments[name];
		const cacheVariables = {
			CMAKE_C_COMPILER: await vscode.commands.executeCommand(`${name}.cc.exe`),
			CMAKE_CXX_COMPILER: await vscode.commands.executeCommand(`${name}.cxx.exe`),
			CMAKE_Fortran_COMPILER: await vscode.commands.executeCommand(`${name}.fc.exe`),
			CMAKE_MAKE_PROGRAM: await vscode.commands.executeCommand(`${name}.${makeTool}.exe`)
		};
		if(env.kitMPI) {
			cacheVariables.MPI_C_COMPILER = await vscode.commands.executeCommand(`${name}.mpicc.exe`);
			cacheVariables.MPI_CXX_COMPILER = await vscode.commands.executeCommand(`${name}.mpicxx.exe`);
			cacheVariables.MPI_Fortran_COMPILER = await vscode.commands.executeCommand(`${name}.mpifort.exe`);
		}
		configurePresets.push({
			displayName: env.kit,
			name,
			generator,
			binaryDir: `\${sourceDir}/build/${name}`,
			environment: {PATH: await vscode.commands.executeCommand(`${name}.path`)},
			cacheVariables
		});
		buildPresets.push({displayName: env.kit, name, configurePreset: name});
	}
	return {
		version: 3,
		configurePresets,
		buildPresets,
		vendor: {[kitsManager]: {presets: kitOrder.slice()}}
	};
}

// Merge the extension-managed presets into the existing descriptor, replacing the same-named entries and keeping the foreign ones intact
function mergePresets(existing, injected) {
	const managed = managedPresetNames(existing);
	const merged = {...existing};
	merged.version = existing.version || injected.version;
	merged.configurePresets = [...(existing.configurePresets || []).filter(preset => !managed.has(preset.name)), ...injected.configurePresets];
	merged.buildPresets = [...(existing.buildPresets || []).filter(preset => !managed.has(preset.name)), ...injected.buildPresets];
	merged.vendor = {...existing.vendor, ...injected.vendor};
	return merged;
}

// Strip the extension-managed presets from the existing descriptor keeping the foreign ones intact
function removePresets(existing) {
	const managed = managedPresetNames(existing);
	const removed = {...existing};
	removed.configurePresets = (existing.configurePresets || []).filter(preset => !managed.has(preset.name));
	removed.buildPresets = (existing.buildPresets || []).filter(preset => !managed.has(preset.name));
	if(existing.vendor) {
		removed.vendor = {...existing.vendor};
		delete removed.vendor[kitsManager];
	}
	return removed;
}

// Inject or remove the extension-managed presets in a CMakePresets.json/CMakeUserPresets.json descriptor, creating it as needed
async function updatePresetsFile(file, inject) {
	let existing = null;
	try {
		const text = await fs.readFile(file, 'utf8');
		if(text.trim()) existing = JSON.parse(text);
	} catch(err) {
		if(err.code != 'ENOENT') throw new Error(`cannot parse ${file}: ${err.message}`);
	}
	if(!existing && !inject) return {file, count: 0}; // nothing to remove, keep the missing descriptor as is
	const updated = inject ? mergePresets(existing || {}, await cmakePresets()) : removePresets(existing);
	await fs.mkdir(path.dirname(file), {recursive: true});
	await fs.writeFile(file, JSON.stringify(updated, null, 2) + '\n');
	const count = inject ? kitOrder.length
		: (existing.configurePresets || []).length - updated.configurePresets.length
			+ (existing.buildPresets || []).length - updated.buildPresets.length;
	return {file, count};
}

// Location of a CMake presets descriptor of the primary workspace folder
function workspacePresetsFile(name) {
	const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
	return folder ? path.join(folder.uri.fsPath, name) : null;
}

// Location of the per-project CMakeUserPresets.json descriptor
function userPresetsFile() {
	return workspacePresetsFile('CMakeUserPresets.json');
}

// Location of the per-project CMakePresets.json descriptor
function projectPresetsFile() {
	return workspacePresetsFile('CMakePresets.json');
}

// Register the commands injecting and removing the extension-managed CMake Presets
function registerPresetsCommands(subscriptions) {
	registerCommand(subscriptions, 'msys2.presets.inject.user', () => runDescriptorUpdate(userPresetsFile(), true, updatePresetsFile, 'CMake Presets'));
	registerCommand(subscriptions, 'msys2.presets.remove.user', () => runDescriptorUpdate(userPresetsFile(), false, updatePresetsFile, 'CMake Presets'));
	registerCommand(subscriptions, 'msys2.presets.inject.project', () => runDescriptorUpdate(projectPresetsFile(), true, updatePresetsFile, 'CMake Presets'));
	registerCommand(subscriptions, 'msys2.presets.remove.project', () => runDescriptorUpdate(projectPresetsFile(), false, updatePresetsFile, 'CMake Presets'));
}

// Apply a kits/presets descriptor update with user-facing notification
async function runDescriptorUpdate(file, inject, update, what) {
	if(!file) {
		vscode.window.showErrorMessage('MSYS2: no workspace folder is open');
		return;
	}
	try {
		const res = await update(file, inject);
		vscode.window.showInformationMessage(`MSYS2: ${res.count} ${what} ${inject ? 'written to' : 'removed from'} ${res.file}`);
	} catch(err) {
		vscode.window.showErrorMessage(`MSYS2: ${err.message}`);
	}
}

// Settings manageable via the dashboard
const dashboardSettings = [
	{name: 'msys2.root', kind: 'text'},
	{name: 'cygwin32.root', kind: 'text'},
	{name: 'cygwin64.root', kind: 'text'},
	{name: 'mingw32.root', kind: 'text'},
	{name: 'mingw32.provider', kind: 'select', options: ['msys2', 'cygwin32', 'cygwin64']},
	{name: 'mingw64.root', kind: 'text'},
	{name: 'mingw64.provider', kind: 'select', options: ['msys2', 'cygwin32', 'cygwin64']},
	{name: 'msys2.presets.generator', kind: 'select', options: ['Ninja', 'Ninja Multi-Config', 'MinGW Makefiles', 'Unix Makefiles']}
];

// Dashboard action targets
const dashboardTargets = {
	'kits.user': {file: userKitsFile, update: updateKitsFile, what: 'CMake Kits'},
	'kits.project': {file: projectKitsFile, update: updateKitsFile, what: 'CMake Kits'},
	'presets.user': {file: userPresetsFile, update: updatePresetsFile, what: 'CMake Presets'},
	'presets.project': {file: projectPresetsFile, update: updatePresetsFile, what: 'CMake Presets'}
};

// Check whether a path exists on disk
async function pathExists(p) {
	try {
		await fs.stat(p);
		return true;
	} catch {
		return false;
	}
}

// Summarize a cmake-kits.json descriptor: whether it exists and how many entries are managed by this extension
async function kitsSummary(file) {
	if(!file || !await pathExists(file)) return {file: file || null, exists: false, managed: 0, foreign: 0};
	try {
		const kits = JSON.parse(await fs.readFile(file, 'utf8'));
		const managedNames = new Set(cmakeKits().map(kit => kit.name));
		const managed = kits.filter(kit => isManagedKit(kit, managedNames)).length;
		return {file, exists: true, managed, foreign: kits.length - managed};
	} catch {
		return {file, exists: true, managed: 0, foreign: 0}; // unparsable descriptor
	}
}

// Summarize a CMake presets descriptor: whether it exists and how many entries are managed by this extension
async function presetsSummary(file) {
	if(!file || !await pathExists(file)) return {file: file || null, exists: false, managed: 0, foreign: 0};
	try {
		const doc = JSON.parse(await fs.readFile(file, 'utf8'));
		const managed = managedPresetNames(doc);
		const managedIn = presets => (presets || []).filter(preset => managed.has(preset.name)).length;
		const total = (doc.configurePresets || []).length + (doc.buildPresets || []).length;
		const managedCount = managedIn(doc.configurePresets) + managedIn(doc.buildPresets);
		return {file, exists: true, managed: managedCount, foreign: total - managedCount};
	} catch {
		return {file, exists: true, managed: 0, foreign: 0}; // unparsable descriptor
	}
}

// Compose the dashboard view model
async function dashboardModel() {
	const config = vscode.workspace.getConfiguration();
	const settings = {};
	for(const setting of dashboardSettings) settings[setting.name] = config.get(setting.name);
	const rows = [];
	for(const name of kitOrder) {
		const root = await vscode.commands.executeCommand(`${name}.root`);
		const tools = [];
		for(const tool of ['cc', 'make', 'ninja']) {
			const toolPath = await vscode.commands.executeCommand(`${name}.${tool}.exe`);
			tools.push({tool, path: toolPath, exists: await pathExists(toolPath)});
		}
		rows.push({name, kit: environments[name].kit, root, bin: await vscode.commands.executeCommand(`${name}.bin`), exists: await pathExists(root), tools});
	}
	return {
		app: vscode.env.appName,
		version: pkg.version,
		settings,
		settingsMeta: dashboardSettings,
		environments: rows,
		kits: {user: await kitsSummary(userKitsFile()), project: await kitsSummary(projectKitsFile())},
		presets: {user: await presetsSummary(userPresetsFile()), project: await presetsSummary(projectPresetsFile())}
	};
}

// Compose the dashboard webview HTML; the model is rendered client-side, so the same code path handles re-renders
function dashboardHtml(model, cspSource, nonce) {
	const json = JSON.stringify(model).replace(/</g, '\\u003c'); // keep the embedded JSON from breaking out of the script element
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; font-size: 13px; }
section { margin: 0 0 20px; }
h1 { font-size: 16px; margin: 0; }
h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; opacity: .8; border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,.4)); padding-bottom: 4px; margin: 0 0 8px; }
header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 4px 8px; border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.4)); }
th { opacity: .8; font-weight: normal; }
code { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; }
.chip { display: inline-block; padding: 0 6px; border-radius: 3px; font-size: 11px; margin: 1px 2px 1px 0; font-family: var(--vscode-editor-font-family, monospace); }
.chip.ok { background: rgba(63,185,80,.25); }
.chip.bad { background: rgba(248,81,73,.25); }
button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; padding: 3px 10px; cursor: pointer; font-size: 12px; margin: 1px 2px 1px 0; }
button:hover { background: var(--vscode-button-hoverBackground); }
button:disabled { opacity: .5; cursor: default; }
input, select { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; padding: 2px 4px; width: 300px; font-size: 12px; font-family: var(--vscode-editor-font-family, monospace); }
.grid { display: grid; grid-template-columns: max-content 320px; gap: 6px 14px; align-items: center; }
.row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
.muted { opacity: .7; }
</style>
</head>
<body>
<header>
<h1>MSYS2 Dashboard</h1>
<span id="app" class="muted"></span>
<span id="version" class="muted"></span>
<button id="refresh" title="Re-resolve the toolchains and descriptors">Refresh</button>
</header>
<section>
<h2>Settings</h2>
<div id="settings" class="grid"></div>
<div class="row" style="margin-top:8px">
<button id="save">Save Settings</button>
<span class="muted">An emptied root reverts to the provider-derived location; values are stored in the user settings.</span>
</div>
</section>
<section><h2>Toolchain Environments</h2><div id="environments"></div></section>
<section><h2>CMake Kits</h2><div id="kits"></div></section>
<section><h2>CMake Presets</h2><div id="presets"></div></section>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let model = ${json};

const el = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const chip = (exists, text, title) => '<span class="chip ' + (exists ? 'ok' : 'bad') + '" title="' + esc(title || text) + '">' + (exists ? '&#10003;' : '&#10007;') + ' ' + esc(text) + '</span>';
const action = (target, op, label, disabled) => '<button data-target="' + target + '" data-op="' + op + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';

function renderSettings() {
	let html = '';
	for(const meta of model.settingsMeta) {
		const value = model.settings[meta.name];
		const id = 'set-' + esc(meta.name);
		html += '<label for="' + id + '">' + esc(meta.name) + '</label>';
		if(meta.kind == 'select') {
			html += '<select id="' + id + '" data-setting="' + esc(meta.name) + '">';
			for(const option of meta.options) html += '<option value="' + esc(option) + '"' + (option == value ? ' selected' : '') + '>' + esc(option) + '</option>';
			html += '</select>';
		}
		else {
			html += '<input id="' + id + '" data-setting="' + esc(meta.name) + '" value="' + esc(value == null ? '' : value) + '" placeholder="&lt;unset&gt;">';
		}
	}
	el('settings').innerHTML = html;
}

function renderEnvironments() {
	let html = '<table><tr><th>Kit</th><th>Root</th><th>Tools</th></tr>';
	for(const env of model.environments) {
		html += '<tr><td>' + esc(env.kit) + '</td><td>' + chip(env.exists, env.root) + '</td><td>'
			+ env.tools.map(tool => chip(tool.exists, tool.tool, tool.path)).join(' ') + '</td></tr>';
	}
	el('environments').innerHTML = html + '</table>';
}

function descriptorRow(title, descriptor, target) {
	const state = descriptor.file ? (descriptor.exists ? descriptor.managed + ' managed, ' + descriptor.foreign + ' foreign' : 'missing') : 'no workspace folder';
	return '<div class="row"><b style="min-width:90px;display:inline-block">' + title + '</b>'
		+ '<code>' + esc(descriptor.file || '&#8212;') + '</code>'
		+ '<span class="muted">' + esc(state) + '</span>'
		+ action(target, 'inject', 'Inject', !descriptor.file)
		+ action(target, 'remove', 'Remove', !descriptor.file) + '</div>';
}

function render() {
	el('app').textContent = model.app;
	el('version').textContent = 'v' + model.version;
	renderSettings();
	renderEnvironments();
	el('kits').innerHTML = descriptorRow('User-Local', model.kits.user, 'kits.user') + descriptorRow('Project', model.kits.project, 'kits.project');
	el('presets').innerHTML = descriptorRow('User', model.presets.user, 'presets.user') + descriptorRow('Project', model.presets.project, 'presets.project');
}

document.addEventListener('click', event => {
	const button = event.target.closest('button[data-target]');
	if(button) vscode.postMessage({type: 'action', target: button.dataset.target, op: button.dataset.op});
});
el('refresh').addEventListener('click', () => vscode.postMessage({type: 'refresh'}));
el('save').addEventListener('click', () => {
	const values = {};
	document.querySelectorAll('[data-setting]').forEach(input => values[input.dataset.setting] = input.value);
	vscode.postMessage({type: 'saveSettings', values});
});
window.addEventListener('message', event => {
	if(event.data && event.data.type == 'model') {
		model = event.data.model;
		render();
	}
});

render();
</script>
</body>
</html>`;
}

// Register the command opening the extension management dashboard
function registerDashboardCommand(subscriptions) {
	let panel = null;
	const postModel = async () => panel && panel.webview.postMessage({type: 'model', model: await dashboardModel()});
	const open = async () => {
		if(panel) {
			panel.reveal();
			return;
		}
		panel = vscode.window.createWebviewPanel('msys2.dashboard', 'MSYS2 Dashboard', vscode.ViewColumn.Active,
			{enableScripts: true, retainContextWhenHidden: true});
		panel.onDidDispose(() => panel = null, null, subscriptions);
		panel.webview.onDidReceiveMessage(async message => {
			if(message.type == 'refresh') {
				await postModel();
			}
			else if(message.type == 'action') {
				const target = dashboardTargets[message.target];
				if(target) await runDescriptorUpdate(target.file(), message.op == 'inject', target.update, target.what);
				await postModel();
			}
			else if(message.type == 'saveSettings') {
				const config = vscode.workspace.getConfiguration();
				const known = new Set(dashboardSettings.map(setting => setting.name));
				for(const [key, value] of Object.entries(message.values)) {
					if(!known.has(key)) continue;
					await config.update(key, value === '' ? undefined : value, vscode.ConfigurationTarget.Global); // an emptied value unsets the setting
				}
				vscode.window.showInformationMessage('MSYS2: settings saved');
				await postModel();
			}
		}, null, subscriptions);
		panel.webview.html = dashboardHtml(await dashboardModel(), panel.webview.cspSource, crypto.randomBytes(16).toString('hex'));
	};
	registerCommand(subscriptions, 'msys2.dashboard', open);
}

function activate(context) {

	const pathSeparator = (process.platform == 'win32' ? ';' : ':');

	const rawPath = process.env.PATH || process.env.Path || '';
	const systemPath = rawPath.split(/\\?;/).join(pathSeparator); // Proper escaping of the system PATH

	registerBuildKitCommands(context.subscriptions, pathSeparator, systemPath);
	registerKitsCommands(context.subscriptions);
	registerPresetsCommands(context.subscriptions);
	registerDashboardCommand(context.subscriptions);

	for(const [name, env] of Object.entries(environments)) {
		registerEnvironment(context.subscriptions, name, env, pathSeparator, systemPath);
	}

	console.log('MSYS2 extension activated');

}

exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate,
	cmakeKits,
	mergeKits,
	removeKits,
	updateKitsFile,
	cmakePresets,
	mergePresets,
	removePresets,
	updatePresetsFile,
	dashboardModel,
	dashboardHtml
}

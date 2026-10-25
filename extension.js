const vscode = require('vscode');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

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
	const update = async (file, inject) => {
		if(!file) {
			vscode.window.showErrorMessage('MSYS2: no workspace folder is open');
			return;
		}
		try {
			const res = await updateKitsFile(file, inject);
			vscode.window.showInformationMessage(`MSYS2: ${res.count} CMake Kits ${inject ? 'written to' : 'removed from'} ${res.file}`);
		} catch(err) {
			vscode.window.showErrorMessage(`MSYS2: ${err.message}`);
		}
	};
	registerCommand(subscriptions, 'msys2.kits.inject.user', () => update(userKitsFile(), true));
	registerCommand(subscriptions, 'msys2.kits.remove.user', () => update(userKitsFile(), false));
	registerCommand(subscriptions, 'msys2.kits.inject.project', () => update(projectKitsFile(), true));
	registerCommand(subscriptions, 'msys2.kits.remove.project', () => update(projectKitsFile(), false));
}

function activate(context) {

	const pathSeparator = (process.platform == 'win32' ? ';' : ':');

	const rawPath = process.env.PATH || process.env.Path || '';
	const systemPath = rawPath.split(/\\?;/).join(pathSeparator); // Proper escaping of the system PATH

	registerBuildKitCommands(context.subscriptions, pathSeparator, systemPath);
	registerKitsCommands(context.subscriptions);

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
	updateKitsFile
}

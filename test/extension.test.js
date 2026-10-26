'use strict';

// Regression suite for the command registry.
//
// The extension is loaded against a minimal mock of the `vscode` API, so the
// suite runs with plain Node (npm test) and requires neither a VS Code
// instance nor an MSYS2/Cygwin installation. Settings defaults are taken from
// package.json, which keeps the manifest and the registry in sync.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {test} = require('node:test');
const Module = require('node:module');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const defaults = Object.fromEntries(
	Object.entries(pkg.contributes.configuration.properties)
		.filter(([, prop]) => prop.default !== undefined)
		.map(([key, prop]) => [key, prop.default])
);

class MockVSCode {
	constructor() {
		this.registered = new Map();
		this.settings = new Map(Object.entries(defaults));
		this.kitName = null;
		this.cmakeToolsInstalled = true;
		this.launchTargetDirectory = 'T:/target';
		this.openDialogOptions = null;
		this.openDialogResult = null;
		this.panels = [];
		this.configUpdates = [];
		this.messages = [];
	}

	commands = {
		registerCommand: (name, handler) => this.registered.set(name, handler),
		executeCommand: async name => {
			if(name === 'cmake.buildKit') {
				if(!this.cmakeToolsInstalled) throw new Error(`command not found: ${name}`);
				return this.kitName;
			}
			if(name === 'cmake.getLaunchTargetDirectory') {
				if(!this.cmakeToolsInstalled) throw new Error(`command not found: ${name}`);
				return this.launchTargetDirectory;
			}
			const handler = this.registered.get(name);
			if(!handler) throw new Error(`command not found: ${name}`);
			return handler();
		}
	};

	env = {appName: 'Visual Studio Code'};

	Uri = {file: p => ({fsPath: p})};

	ViewColumn = {Active: 1};

	ConfigurationTarget = {Global: 1, Workspace: 2, WorkspaceFolder: 3};

	window = {
		showOpenDialog: async options => {
			this.openDialogOptions = options;
			return this.openDialogResult;
		},
		showInformationMessage: async message => this.messages.push(message),
		showErrorMessage: async message => this.messages.push(message),
		createWebviewPanel: () => {
			const panel = {
				postings: [],
				handlers: [],
				onDidDispose() {},
				reveal() {},
				webview: {
					cspSource: 'https://test.csp',
					html: '',
					onDidReceiveMessage: handler => panel.handlers.push(handler),
					postMessage: async message => panel.postings.push(message)
				}
			};
			this.panels.push(panel);
			return panel;
		}
	};

	workspace = {
		workspaceFolders: null,
		getConfiguration: () => ({
			get: key => this.settings.get(key),
			update: async (key, value, target) => {
				this.configUpdates.push({key, value, target});
				if(value === undefined) this.settings.delete(key);
				else this.settings.set(key, value);
			}
		})
	};
}

function loadExtension() {
	const mock = new MockVSCode();
	const originalRequire = Module.prototype.require;
	Module.prototype.require = function(id) {
		return id === 'vscode' ? mock : originalRequire.apply(this, arguments);
	};
	try {
		delete require.cache[require.resolve('../extension.js')];
		const subscriptions = [];
		const extension = require('../extension.js');
		extension.activate({subscriptions});
		mock.subscriptions = subscriptions;
		mock.extension = extension;
	} finally {
		Module.prototype.require = originalRequire;
	}
	return mock;
}

// Deterministic system PATH as seen by the extension at activation time
process.env.PATH = 'C:/sys32;C:\\sys64\\';
const pathSeparator = (process.platform == 'win32' ? ';' : ':');
const systemPath = 'C:/sys32;C:\\sys64\\'.split(/\\?;/).join(pathSeparator);

const mock = loadExtension();
const run = name => mock.registered.get(name)();
const set = overrides => {
	mock.settings = new Map(Object.entries({...defaults, ...overrides}));
	mock.kitName = null;
	mock.cmakeToolsInstalled = true;
};

test('registers the complete command set', () => {
	assert.equal(mock.registered.size, 133);
	// Every command disposable is deferred to the extension subscriptions
	assert.equal(mock.subscriptions.length, mock.registered.size);
	for(const cmd of ['msys2.kits.inject.user', 'msys2.kits.remove.user', 'msys2.kits.inject.project', 'msys2.kits.remove.project',
		'msys2.presets.inject.user', 'msys2.presets.remove.user', 'msys2.presets.inject.project', 'msys2.presets.remove.project',
		'msys2.dashboard']) {
		assert.ok(mock.registered.has(cmd), cmd);
	}
	for(const env of ['msys2', 'cygwin32', 'cygwin64', 'mingw32', 'mingw64', 'clang32', 'clang64', 'ucrt64']) {
		for(const cmd of ['root', 'bin', 'path', 'gdb.exe', 'cmake.exe', 'meson.exe', 'make.exe', 'ninja.exe', 'cc.exe', 'cxx.exe', 'fc.exe']) {
			assert.ok(mock.registered.has(`${env}.${cmd}`), `${env}.${cmd}`);
		}
	}
	// Only the POSIX-like environments expose Bash
	assert.ok(mock.registered.has('msys2.bash.exe'));
	assert.ok(!mock.registered.has('mingw64.bash.exe'));
	// Cygwin environments carry no MPI tools
	assert.ok(!mock.registered.has('cygwin64.mpicc.exe'));
});

test('MSYS2 defaults with backslash normalization', async () => {
	set({});
	assert.equal(await run('msys2.root'), 'c:/msys64');
	assert.equal(await run('msys2.bin'), 'c:/msys64/usr/bin');
	assert.equal(await run('msys2.cc.exe'), 'c:/msys64/usr/bin/gcc.exe');
	assert.equal(await run('msys2.path'), `c:/msys64/usr/bin${pathSeparator}${systemPath}`);
});

test('MSYS2 children derive from msys2.root', async () => {
	set({'msys2.root': 'E:\\msys2'});
	assert.equal(await run('ucrt64.root'), 'E:/msys2/ucrt64');
	assert.equal(await run('clang32.fc.exe'), 'E:/msys2/clang32/bin/flang.exe');
	assert.equal(await run('clang64.cc.exe'), 'E:/msys2/clang64/bin/clang.exe');
	assert.equal(await run('ucrt64.make.exe'), 'E:/msys2/ucrt64/bin/mingw32-make.exe');
});

test('MinGW defaults to the MSYS2 provider', async () => {
	set({});
	assert.equal(await run('mingw32.cc.exe'), 'c:/msys64/mingw32/bin/gcc.exe');
	assert.equal(await run('mingw64.cc.exe'), 'c:/msys64/mingw64/bin/gcc.exe');
	assert.equal(await run('mingw64.make.exe'), 'c:/msys64/mingw64/bin/mingw32-make.exe');
});

test('MinGW hosted by Cygwin uses cross-prefixed tools and make', async () => {
	set({'mingw32.provider': 'cygwin64', 'mingw64.provider': 'cygwin32'});
	assert.equal(await run('mingw32.cc.exe'), 'c:/cygwin64/bin/i686-w64-mingw32-gcc.exe');
	assert.equal(await run('mingw64.cxx.exe'), 'c:/cygwin/bin/x86_64-w64-mingw32-g++.exe');
	assert.equal(await run('mingw32.make.exe'), 'c:/cygwin64/bin/make.exe');
});

test('Explicit mingw root selects the standalone toolchain', async () => {
	set({'mingw32.root': 'D:\\TDM-GCC32'});
	assert.equal(await run('mingw32.root'), 'D:/TDM-GCC32');
	assert.equal(await run('mingw32.cxx.exe'), 'D:/TDM-GCC32/bin/g++.exe');
	assert.equal(await run('mingw32.make.exe'), 'D:/TDM-GCC32/bin/mingw32-make.exe');
});

test('Unknown MinGW provider falls back to the default MSYS2 one', async () => {
	set({'mingw32.provider': 'bogus'});
	assert.equal(await run('mingw32.root'), 'c:/msys64/mingw32');
	assert.equal(await run('mingw32.cc.exe'), 'c:/msys64/mingw32/bin/gcc.exe');
});

test('buildkit commands delegate to the environment of the active kit', async () => {
	set({});
	mock.kitName = 'MSYS2 UCRT64'; // precedence: ucrt64 wins over msys2
	assert.equal(await run('cmake.buildkit.cmake.exe'), 'c:/msys64/ucrt64/bin/cmake.exe');
	mock.kitName = 'MinGW64';
	assert.equal(await run('cmake.buildkit.bin'), 'c:/msys64/mingw64/bin');
	assert.equal(await run('cmake.buildkit.launch.path'), `T:/target${pathSeparator}c:/msys64/mingw64/bin${pathSeparator}${systemPath}`);
	mock.kitName = 'Cygwin32';
	assert.equal(await run('cmake.buildkit.gdb.exe'), 'c:/cygwin/bin/gdb.exe');
	mock.kitName = 'Clang64';
	assert.equal(await run('cmake.buildkit.cxx.exe'), 'c:/msys64/clang64/bin/clang++.exe');
});

test('buildkit commands degrade gracefully without a recognized kit', async () => {
	set({});
	mock.kitName = null;
	assert.equal(await run('cmake.buildkit.cmake.exe'), 'cmake');
	assert.equal(await run('cmake.buildkit.bin'), null);
	mock.kitName = 'Some Alien Kit';
	assert.equal(await run('cmake.buildkit.cc.exe'), 'cc');
	// Without a recognized kit, the launch PATH degrades to the target directory plus the system PATH
	assert.equal(await run('cmake.buildkit.launch.path'), `T:/target${pathSeparator}${systemPath}`);
});

test('Cygwin kits expose no MPI tools', async () => {
	set({});
	mock.kitName = 'Cygwin64';
	// No MS-MPI under Cygwin: degrade to the bare driver name like an unrecognized kit does
	assert.equal(await run('cmake.buildkit.mpicc.exe'), 'mpicc');
});

test('buildkit commands degrade gracefully without CMakeTools installed', async () => {
	set({});
	mock.cmakeToolsInstalled = false;
	assert.equal(await run('cmake.buildkit.cmake.exe'), 'cmake');
	assert.equal(await run('cmake.buildkit.gdb.exe'), 'gdb');
	assert.equal(await run('cmake.buildkit.bin'), null);
	// the launch PATH degrades to the plain system PATH as there is no launch target directory either
	assert.equal(await run('cmake.buildkit.launch.path'), systemPath);
	// kits/presets management is unaffected as it never queries CMakeTools
	assert.equal((await mock.extension.cmakeKits()).length, 8);
});

test('generator selection follows cmake.generator', async () => {
	set({});
	mock.kitName = 'UCRT64';
	assert.equal(await run('cmake.buildkit.generator.exe'), 'c:/msys64/ucrt64/bin/mingw32-make.exe');
	set({'cmake.generator': 'Ninja Multi-Config'});
	mock.kitName = 'UCRT64';
	assert.equal(await run('cmake.buildkit.generator.exe'), 'c:/msys64/ucrt64/bin/ninja.exe');
	// An unrecognized generator falls back to the default make tool
	set({'cmake.generator': 'Visual Studio 17 2022'});
	mock.kitName = 'UCRT64';
	assert.equal(await run('cmake.buildkit.generator.exe'), 'c:/msys64/ucrt64/bin/mingw32-make.exe');
});

test('managed CMake Kits match the toolchain environments', async () => {
	const kits = await mock.extension.cmakeKits();
	assert.deepEqual(kits.map(kit => kit.name), ['MinGW32', 'MinGW64', 'UCRT64', 'Clang32', 'Clang64', 'MSYS2', 'Cygwin32', 'Cygwin64']);
	for(const kit of kits) {
		assert.equal(kit.manager, 'fougas.msys2', kit.name);
		assert.equal(kit.keep, true, kit.name);
		assert.ok(kit.environmentVariables.PATH.startsWith('${command:'), kit.name);
		// none of the tools exist on this machine, hence every explicit variable is kept
		assert.ok(kit.cmakeSettings.CMAKE_C_COMPILER.startsWith('${command:'), kit.name);
	}
	const mingw = kits.find(kit => kit.name == 'MinGW64');
	assert.equal(mingw.preferredGenerator.name, 'MinGW Makefiles');
	assert.equal(mingw.environmentVariables.PATH, '${command:mingw64.path}');
	assert.equal(mingw.cmakeSettings.MPI_Fortran_COMPILER, '${command:mingw64.mpifort.exe}');
	const msys = kits.find(kit => kit.name == 'MSYS2');
	assert.equal(msys.preferredGenerator.name, 'Unix Makefiles');
	assert.equal(msys.cmakeSettings.MPI_C_COMPILER, undefined); // no MPI under the POSIX-like environments
});

test('merging preserves foreign kits and replaces the managed ones', async () => {
	const existing = [
		{name: 'Custom-Clang-LLVM', keep: true},
		{name: 'MinGW64', compilers: {C: 'D:/old/gcc.exe'}} // legacy hand-pasted entry
	];
	const merged = mock.extension.mergeKits(existing, await mock.extension.cmakeKits());
	assert.equal(merged.length, 9);
	assert.ok(merged.some(kit => kit.name == 'Custom-Clang-LLVM' && kit.manager === undefined));
	const mingw = merged.filter(kit => kit.name == 'MinGW64');
	assert.equal(mingw.length, 1); // the legacy entry is replaced by the managed one
	assert.equal(mingw[0].manager, 'fougas.msys2');
});

test('removal strips the managed and legacy same-named kits only', () => {
	const existing = [
		{name: 'Custom-Clang-LLVM', keep: true},
		{name: 'MinGW64'}, // legacy same-named entry
		{name: 'UCRT64', manager: 'fougas.msys2'},
		{name: 'Alien', manager: 'fougas.msys2'} // marker-bearing entry is ours regardless of the name
	];
	const remaining = mock.extension.removeKits(existing);
	assert.deepEqual(remaining.map(kit => kit.name), ['Custom-Clang-LLVM']);
});

test('foreign kits remain intact through inject and remove', async () => {
	const foreign = [
		{name: 'Custom-Clang-LLVM', compilers: {C: '/usr/bin/clang'}, preferredGenerator: {name: 'Ninja'}, keep: true},
		{name: 'GCC 13.2', compilers: {C: 'D:\\tools\\gcc.exe'}, environmentVariables: {PATH: 'D:\\tools\\bin'}}
	];
	const injected = mock.extension.mergeKits([...foreign, {name: 'MinGW64', compilers: {C: 'D:/old/gcc.exe'}}], await mock.extension.cmakeKits());
	// the foreign entries are passed through as the very same objects, not rebuilt copies
	assert.equal(injected[0], foreign[0]);
	assert.equal(injected[1], foreign[1]);
	assert.deepEqual(injected.slice(0, 2), foreign);
	const removed = mock.extension.removeKits(injected);
	assert.deepEqual(removed, foreign);
	assert.equal(removed[0], foreign[0]);
});

test('kits descriptor round-trip via inject and remove', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msys2-kits-'));
	try {
		const file = path.join(dir, '.vscode', 'cmake-kits.json');
		assert.equal((await mock.extension.updateKitsFile(file, true)).count, 8);
		let kits = JSON.parse(fs.readFileSync(file, 'utf8'));
		assert.equal(kits.length, 8);
		kits.push({name: 'Custom', keep: true});
		fs.writeFileSync(file, JSON.stringify(kits, null, 2));
		assert.equal((await mock.extension.updateKitsFile(file, true)).count, 8); // idempotent re-inject
		kits = JSON.parse(fs.readFileSync(file, 'utf8'));
		assert.equal(kits.length, 9); // the foreign kit survives, the managed ones are refreshed
		assert.equal((await mock.extension.updateKitsFile(file, false)).count, 8);
		kits = JSON.parse(fs.readFileSync(file, 'utf8'));
		assert.deepEqual(kits.map(kit => kit.name), ['Custom']);
	} finally {
		fs.rmSync(dir, {recursive: true, force: true});
	}
});

test('non-array kits descriptor is reported as unparsable', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msys2-kits-bad-'));
	try {
		const file = path.join(dir, 'cmake-kits.json');
		fs.writeFileSync(file, '{"not": "an array"}');
		await assert.rejects(() => mock.extension.updateKitsFile(file, true), /not a JSON array/);
	} finally {
		fs.rmSync(dir, {recursive: true, force: true});
	}
});

test('managed CMake Presets match the toolchain environments', async () => {
	set({});
	const presets = await mock.extension.cmakePresets();
	const names = ['mingw32', 'mingw64', 'ucrt64', 'clang32', 'clang64', 'msys2', 'cygwin32', 'cygwin64'];
	assert.equal(presets.version, 3);
	assert.deepEqual(presets.configurePresets.map(preset => preset.name), names);
	assert.deepEqual(presets.buildPresets.map(preset => preset.name), names);
	assert.deepEqual(presets.vendor['fougas.msys2'].presets, names);
	assert.ok(!JSON.stringify(presets).includes('${command:'), 'paths must be baked, not command substitutions');
	const ucrt = presets.configurePresets.find(preset => preset.name == 'ucrt64');
	assert.equal(ucrt.displayName, 'UCRT64');
	assert.equal(ucrt.generator, 'Ninja');
	assert.equal(ucrt.binaryDir, '${sourceDir}/build/ucrt64');
	assert.equal(ucrt.cacheVariables.CMAKE_C_COMPILER, 'c:/msys64/ucrt64/bin/gcc.exe');
	assert.equal(ucrt.cacheVariables.CMAKE_MAKE_PROGRAM, 'c:/msys64/ucrt64/bin/ninja.exe');
	assert.equal(ucrt.cacheVariables.MPI_C_COMPILER, 'c:/msys64/ucrt64/bin/mpicc.exe');
	assert.ok(ucrt.environment.PATH.startsWith(`c:/msys64/ucrt64/bin${pathSeparator}`));
	const msys = presets.configurePresets.find(preset => preset.name == 'msys2');
	assert.equal(msys.cacheVariables.MPI_C_COMPILER, undefined); // no MPI under the POSIX-like environments
	assert.equal(msys.cacheVariables.CMAKE_MAKE_PROGRAM, 'c:/msys64/usr/bin/ninja.exe');
	assert.equal(presets.buildPresets.find(preset => preset.name == 'mingw64').configurePreset, 'mingw64');
});

test('presets generator follows the msys2.presets.generator setting', async () => {
	set({'msys2.presets.generator': 'MinGW Makefiles'});
	let presets = await mock.extension.cmakePresets();
	let mingw = presets.configurePresets.find(preset => preset.name == 'mingw32');
	assert.equal(mingw.generator, 'MinGW Makefiles');
	assert.equal(mingw.cacheVariables.CMAKE_MAKE_PROGRAM, 'c:/msys64/mingw32/bin/mingw32-make.exe');
	let msys = presets.configurePresets.find(preset => preset.name == 'msys2');
	assert.equal(msys.cacheVariables.CMAKE_MAKE_PROGRAM, 'c:/msys64/usr/bin/make.exe');
	set({'msys2.presets.generator': 'Ninja Multi-Config'});
	presets = await mock.extension.cmakePresets();
	mingw = presets.configurePresets.find(preset => preset.name == 'mingw32');
	assert.equal(mingw.generator, 'Ninja Multi-Config');
	assert.equal(mingw.cacheVariables.CMAKE_MAKE_PROGRAM, 'c:/msys64/mingw32/bin/ninja.exe');
});

test('merging presets preserves foreign entries and root fields', async () => {
	set({});
	const foreignConfigure = {name: 'custom', generator: 'Ninja', binaryDir: '${sourceDir}/build/custom'};
	const foreignBuild = {name: 'custom', configurePreset: 'custom'};
	const existing = {
		version: 6,
		configurePresets: [foreignConfigure, {name: 'ucrt64', generator: 'Legacy'}],
		buildPresets: [foreignBuild, {name: 'ucrt64', configurePreset: 'ucrt64'}],
		testPresets: [{name: 'custom', configurePreset: 'custom'}],
		cmakeMinimumRequired: '3.23'
	};
	const merged = mock.extension.mergePresets(existing, await mock.extension.cmakePresets());
	assert.equal(merged.version, 6); // preserved, not downgraded
	assert.equal(merged.configurePresets.length, 9); // foreign + 8 managed
	assert.equal(merged.configurePresets[0], foreignConfigure); // same reference, not a rebuilt copy
	assert.equal(merged.buildPresets[0], foreignBuild);
	assert.equal(merged.testPresets, existing.testPresets); // foreign root field untouched
	assert.equal(merged.cmakeMinimumRequired, '3.23');
	assert.equal(merged.configurePresets.filter(preset => preset.name == 'ucrt64').length, 1); // the legacy entry is replaced
	assert.equal(merged.vendor['fougas.msys2'].presets.length, 8);
});

test('preset removal strips the managed and vendor-recorded entries only', () => {
	const existing = {
		version: 3,
		configurePresets: [
			{name: 'custom'},
			{name: 'ucrt64'}, // legacy same-named entry
			{name: 'recorded'} // vendor-recorded entry outside the canonical set
		],
		buildPresets: [{name: 'custom'}, {name: 'mingw64'}],
		vendor: {'fougas.msys2': {presets: ['recorded']}}
	};
	const remaining = mock.extension.removePresets(existing);
	assert.deepEqual(remaining.configurePresets.map(preset => preset.name), ['custom']);
	assert.deepEqual(remaining.buildPresets.map(preset => preset.name), ['custom']);
	assert.equal(remaining.vendor['fougas.msys2'], undefined);
});

test('presets descriptor round-trip via inject and remove', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msys2-presets-'));
	try {
		const file = path.join(dir, 'CMakeUserPresets.json');
		assert.equal((await mock.extension.updatePresetsFile(file, true)).count, 8);
		let doc = JSON.parse(fs.readFileSync(file, 'utf8'));
		assert.equal(doc.version, 3);
		assert.equal(doc.configurePresets.length, 8);
		assert.equal(doc.buildPresets.length, 8);
		doc.configurePresets.push({name: 'custom'});
		doc.buildPresets.push({name: 'custom'});
		doc.version = 4;
		fs.writeFileSync(file, JSON.stringify(doc));
		assert.equal((await mock.extension.updatePresetsFile(file, true)).count, 8); // idempotent re-inject
		doc = JSON.parse(fs.readFileSync(file, 'utf8'));
		assert.equal(doc.version, 4); // preserved
		assert.equal(doc.configurePresets.length, 9); // the foreign preset survives
		assert.equal((await mock.extension.updatePresetsFile(file, false)).count, 16); // 8 configure + 8 build removed
		doc = JSON.parse(fs.readFileSync(file, 'utf8'));
		assert.deepEqual(doc.configurePresets.map(preset => preset.name), ['custom']);
		assert.deepEqual(doc.buildPresets.map(preset => preset.name), ['custom']);
		const missing = path.join(dir, 'sub', 'CMakeUserPresets.json');
		assert.equal((await mock.extension.updatePresetsFile(missing, false)).count, 0); // removal of a missing descriptor is a no-op
		assert.equal(fs.existsSync(missing), false);
	} finally {
		fs.rmSync(dir, {recursive: true, force: true});
	}
});

test('dashboard model summarizes environments and descriptors', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msys2-dash-'));
	try {
		const bin = path.join(dir, 'msys64', 'usr', 'bin');
		fs.mkdirSync(bin, {recursive: true});
		for(const exe of ['gcc.exe', 'make.exe', 'ninja.exe']) fs.writeFileSync(path.join(bin, exe), '');
		set({'msys2.root': path.join(dir, 'msys64')});
		mock.workspace.workspaceFolders = [{uri: {fsPath: path.join(dir, 'ws')}}];
		const model = await mock.extension.dashboardModel();
		assert.equal(model.environments.length, 8);
		assert.ok(model.version);
		assert.ok(!('app' in model)); // the host application name is not a part of the model
		assert.equal(model.settings['msys2.presets.generator'], 'Ninja');
		const msysRow = model.environments.find(row => row.name == 'msys2');
		assert.equal(msysRow.exists, true); // the fake root is on disk
		assert.equal(msysRow.tools.find(tool => tool.tool == 'cc').exists, true); // gcc.exe created above
		assert.equal(msysRow.tools.find(tool => tool.tool == 'ninja').exists, true);
		const mingwRow = model.environments.find(row => row.name == 'mingw32');
		assert.equal(mingwRow.exists, false); // no mingw32 subdir within the fake root
		assert.equal(mingwRow.tools.find(tool => tool.tool == 'cc').exists, false);
		assert.equal(model.kits.project.exists, false); // no descriptors yet
		assert.equal(model.presets.project.exists, false);
		assert.equal(model.presets.user.file, path.join(dir, 'ws', 'CMakeUserPresets.json'));
		await mock.extension.updateKitsFile(model.kits.project.file, true);
		await mock.extension.updatePresetsFile(model.presets.user.file, true);
		const refreshed = await mock.extension.dashboardModel();
		assert.deepEqual(refreshed.kits.project, {file: model.kits.project.file, exists: true, managed: 8, foreign: 0});
		assert.deepEqual(refreshed.presets.user, {file: model.presets.user.file, exists: true, managed: 16, foreign: 0});
		// the set roots are validated against the disk: the existing one passes, the unset ones are not flagged
		assert.equal(refreshed.settingsValidity['msys2.root'], true);
		assert.ok(!('mingw32.root' in refreshed.settingsValidity));
	} finally {
		mock.workspace.workspaceFolders = null;
		fs.rmSync(dir, {recursive: true, force: true});
	}
});

test('dashboard root settings get working directory pickers', async () => {
	set({});
	await run('msys2.dashboard');
	const panel = mock.panels[0];
	assert.equal(panel.handlers.length, 1);
	const onMessage = panel.handlers[0];
	// a cancelled dialog posts nothing back
	mock.openDialogResult = null;
	await onMessage({type: 'pickDirectory', setting: 'msys2.root'});
	assert.equal(panel.postings.length, 0);
	// a picked directory is posted back to the field, with the dialog anchored at the current value
	mock.openDialogResult = [{fsPath: 'D:/msys2-root'}];
	await onMessage({type: 'pickDirectory', setting: 'msys2.root'});
	assert.deepEqual(mock.openDialogOptions, {
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		defaultUri: {fsPath: 'c:\\msys64'}
	});
	assert.deepEqual(panel.postings, [{type: 'picked', setting: 'msys2.root', path: 'D:/msys2-root'}]);
	// unset settings open the dialog with no default location
	mock.openDialogResult = null;
	await onMessage({type: 'pickDirectory', setting: 'mingw32.root'});
	assert.equal(mock.openDialogOptions.defaultUri, undefined);
	// non-directory settings get no picker
	await onMessage({type: 'pickDirectory', setting: 'mingw32.provider'});
	assert.equal(panel.postings.length, 1);
	// unknown settings get no picker either
	await onMessage({type: 'pickDirectory', setting: 'bogus.setting'});
	assert.equal(panel.postings.length, 1);
});

test('dashboard flags the settings roots missing on disk', async () => {
	set({'msys2.root': 'Q:/no/such/dir'});
	const model = await mock.extension.dashboardModel();
	assert.equal(model.settingsValidity['msys2.root'], false);
});

test('per-project build system switch follows and drives cmake.useCMakePresets', async () => {
	set({});
	mock.workspace.workspaceFolders = [{uri: {fsPath: 'P:/ws'}}];
	// the effective state derives from the CMakeTools setting
	assert.equal((await mock.extension.dashboardModel()).buildSystem, 'auto');
	set({'useCMakePresets': 'never'});
	assert.equal((await mock.extension.dashboardModel()).buildSystem, 'kits');
	set({'useCMakePresets': 'always'});
	assert.equal((await mock.extension.dashboardModel()).buildSystem, 'presets');
	// legacy boolean forms of the setting are recognized as well
	set({'useCMakePresets': false});
	assert.equal((await mock.extension.dashboardModel()).buildSystem, 'kits');
	// the switch writes the folder-scoped override
	set({});
	await run('msys2.dashboard'); // reveals the panel kept by the singleton command, its message handler stays the same
	const onMessage = mock.panels[mock.panels.length - 1].handlers[0];
	await onMessage({type: 'buildSystem', value: 'kits'});
	assert.deepEqual(mock.configUpdates[0], {key: 'useCMakePresets', value: 'never', target: 3});
	await onMessage({type: 'buildSystem', value: 'presets'});
	assert.deepEqual(mock.configUpdates[1], {key: 'useCMakePresets', value: 'always', target: 3});
	await onMessage({type: 'buildSystem', value: 'auto'});
	assert.equal(mock.configUpdates[2].value, undefined);
	assert.equal(mock.settings.has('useCMakePresets'), false); // the override is cleared
	// without a workspace folder the switch reports an error
	mock.workspace.workspaceFolders = null;
	await onMessage({type: 'buildSystem', value: 'kits'});
	assert.ok(mock.messages.some(m => m.includes('no workspace folder')));
});

test('tool variables are omitted when the tools are locatable via the PATH', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msys2-findable-'));
	try {
		const bin = path.join(dir, 'usr', 'bin');
		fs.mkdirSync(bin, {recursive: true});
		for(const exe of ['gcc.exe', 'g++.exe', 'gfortran.exe', 'make.exe', 'ninja.exe']) fs.writeFileSync(path.join(bin, exe), '');
		set({'msys2.root': dir});
		// canonical tools present within the toolchain bin: the explicit variables are omitted
		const kits = await mock.extension.cmakeKits();
		const msys = kits.find(kit => kit.name == 'MSYS2');
		assert.equal(msys.cmakeSettings.CMAKE_C_COMPILER, undefined);
		assert.equal(msys.cmakeSettings.CMAKE_Fortran_COMPILER, undefined);
		assert.equal(msys.environmentVariables.PATH, '${command:msys2.path}'); // the PATH itself stays
		// a missing toolchain keeps every explicit variable
		assert.ok(kits.find(kit => kit.name == 'UCRT64').cmakeSettings.CMAKE_C_COMPILER.startsWith('${command:'));
		// the presets behave the same and prepend the bin directory to the existing PATH instead of baking the system one
		const presets = await mock.extension.cmakePresets();
		const msysPreset = presets.configurePresets.find(preset => preset.name == 'msys2');
		assert.equal(msysPreset.cacheVariables.CMAKE_C_COMPILER, undefined);
		assert.equal(msysPreset.cacheVariables.CMAKE_MAKE_PROGRAM, undefined); // ninja is locatable
		assert.equal(msysPreset.environment.PATH, `${bin}${pathSeparator}$penv{PATH}`);
		const ucrtPreset = presets.configurePresets.find(preset => preset.name == 'ucrt64');
		assert.equal(ucrtPreset.cacheVariables.CMAKE_C_COMPILER, `${dir}/ucrt64/bin/gcc.exe`);
		// a Cygwin-hosted cross-prefixed compiler keeps the explicit variable even when present on disk:
		// its name is not what CMake searches for, and a bare-name lookup would locate the wrong tool
		const crossBin = path.join(dir, 'cyg64', 'bin');
		fs.mkdirSync(crossBin, {recursive: true});
		fs.writeFileSync(path.join(crossBin, 'i686-w64-mingw32-gcc.exe'), '');
		set({'msys2.root': dir, 'mingw32.provider': 'cygwin64', 'cygwin64.root': path.join(dir, 'cyg64')});
		const cross = (await mock.extension.cmakeKits()).find(kit => kit.name == 'MinGW32');
		assert.equal(cross.cmakeSettings.CMAKE_C_COMPILER, '${command:mingw32.cc.exe}');
	} finally {
		fs.rmSync(dir, {recursive: true, force: true});
	}
});

test('dashboard HTML embeds the model behind a strict CSP', async () => {
	set({});
	const model = await mock.extension.dashboardModel();
	const html = mock.extension.dashboardHtml(model, 'https://test.csp', 'abc123nonce');
	assert.ok(html.includes("script-src 'nonce-abc123nonce'"));
	assert.ok(html.includes('acquireVsCodeApi'));
	assert.equal((html.match(/<script/g) || []).length, 1); // a single, nonce'd script
	// the model is embedded for the initial client-side render
	assert.ok(html.includes(`"version":"${model.version}"`));
	// every dashboard action target is reachable
	for(const target of ['kits.user', 'kits.project', 'presets.user', 'presets.project']) {
		assert.ok(html.includes(`'${target}'`), target);
	}
	// the settings form is driven by the embedded metadata
	assert.ok(html.includes('data-setting='));
	// the settings are laid out in two purpose-separated columns driven by the embedded metadata
	assert.ok(html.includes('"settingsGroups":{"locations":"Locations","selections":"Selections"}'));
	assert.ok(html.includes('.group { display: grid'));
	// the text entries and the dropdowns share the same rendered width
	assert.ok(html.includes('width: 100%; box-sizing: border-box'));
	// the dir-kind settings carry directory picker buttons wired to the host dialog
	assert.ok(html.includes('data-pick='));
	assert.ok(html.includes("'pickDirectory'"));
	assert.ok(html.includes("'picked'"));
	// the descriptor rows render as a single grid keeping the action buttons column-aligned
	assert.ok(html.includes('id="descriptors"'));
	assert.ok(html.includes('.descriptors { display: grid'));
	assert.ok(!html.includes("el('kits')") && !html.includes("el('presets')"));
	// a missing descriptor path renders as an em-dash entity rather than getting escaped into literal text
	assert.ok(html.includes(`descriptor.file ? esc(descriptor.file) : '&#8212;'`));
	// the header carries no host application name
	assert.ok(!html.includes('id="app"'));
	// the missing root directories are highlighted and a picked directory clears the highlight
	assert.ok(html.includes('input.invalid'));
	assert.ok(html.includes("classList.remove('invalid')"));
	// the per-project build system switch is present and model-driven
	assert.ok(html.includes('id="buildsystem"'));
	assert.ok(html.includes('"buildSystem":"auto"'));
	// the remove actions are labeled to complement the inject ones
	assert.ok(html.includes(`action(target, 'remove', 'Yank'`));
});

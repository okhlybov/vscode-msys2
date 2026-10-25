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
		this.launchTargetDirectory = 'T:/target';
	}

	commands = {
		registerCommand: (name, handler) => this.registered.set(name, handler),
		executeCommand: async name => {
			if(name === 'cmake.buildKit') return this.kitName;
			if(name === 'cmake.getLaunchTargetDirectory') return this.launchTargetDirectory;
			const handler = this.registered.get(name);
			if(!handler) throw new Error(`command not found: ${name}`);
			return handler();
		}
	};

	workspace = {
		getConfiguration: () => ({get: key => this.settings.get(key)})
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
};

test('registers the complete command set', () => {
	assert.equal(mock.registered.size, 132);
	// Every command disposable is deferred to the extension subscriptions
	assert.equal(mock.subscriptions.length, mock.registered.size);
	for(const cmd of ['msys2.kits.inject.user', 'msys2.kits.remove.user', 'msys2.kits.inject.project', 'msys2.kits.remove.project',
		'msys2.presets.inject.user', 'msys2.presets.remove.user', 'msys2.presets.inject.project', 'msys2.presets.remove.project']) {
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

test('managed CMake Kits match the toolchain environments', () => {
	const kits = mock.extension.cmakeKits();
	assert.deepEqual(kits.map(kit => kit.name), ['MinGW32', 'MinGW64', 'UCRT64', 'Clang32', 'Clang64', 'MSYS2', 'Cygwin32', 'Cygwin64']);
	for(const kit of kits) {
		assert.equal(kit.manager, 'fougas.msys2', kit.name);
		assert.equal(kit.keep, true, kit.name);
		assert.ok(kit.environmentVariables.PATH.startsWith('${command:'), kit.name);
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

test('merging preserves foreign kits and replaces the managed ones', () => {
	const existing = [
		{name: 'Custom-Clang-LLVM', keep: true},
		{name: 'MinGW64', compilers: {C: 'D:/old/gcc.exe'}} // legacy hand-pasted entry
	];
	const merged = mock.extension.mergeKits(existing);
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

test('foreign kits remain intact through inject and remove', () => {
	const foreign = [
		{name: 'Custom-Clang-LLVM', compilers: {C: '/usr/bin/clang'}, preferredGenerator: {name: 'Ninja'}, keep: true},
		{name: 'GCC 13.2', compilers: {C: 'D:\\tools\\gcc.exe'}, environmentVariables: {PATH: 'D:\\tools\\bin'}}
	];
	const injected = mock.extension.mergeKits([...foreign, {name: 'MinGW64', compilers: {C: 'D:/old/gcc.exe'}}]);
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

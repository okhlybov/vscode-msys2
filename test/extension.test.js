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
		require('../extension.js').activate({subscriptions});
		mock.subscriptions = subscriptions;
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
	assert.equal(mock.registered.size, 124);
	// Every command disposable is deferred to the extension subscriptions
	assert.equal(mock.subscriptions.length, mock.registered.size);
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

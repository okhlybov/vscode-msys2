const vscode = require('vscode');

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
function BuildKitExe(exe, fallback = null) {
	return BuildKit().then(kit => {
		return kit ? vscode.commands.executeCommand(`${kit}.${exe}.exe`) : (fallback ? fallback : exe);
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
	const prov = MinGWProvider(bit);
	switch(prov) {
		case 'msys2': return `${rootOf('msys2')}/mingw${bit}`;
		case 'cygwin32': case 'cygwin64': return rootOf(prov);
		default: return normalizePath(vscode.workspace.getConfiguration().get(`mingw${bit}.root`));
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
		bin: 'bin',
		root: () => normalizePath(vscode.workspace.getConfiguration().get(`cygwin${bit}.root`)),
		tools: { bash: 'bash.exe', ...commonTools, ...gnuTools }
	};
}

// MinGW toolchain environment: provided by MSYS2 by default or by Cygwin with cross-prefixed tools, or a standalone one
function mingwEnv(bit) {
	const prefix = `${bit == 32 ? 'i686' : 'x86_64'}-w64-mingw32`;
	return {
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
		bin: 'bin',
		root: () => `${rootOf('msys2')}/ucrt64`,
		tools: { ...commonTools, ...gnuTools, ...mpiTools, make: 'mingw32-make.exe' }
	}
};

// Tools retrievable for the buildkit in effect
const buildkitTools = ['cmake', 'meson', 'ninja', 'make', 'gdb', 'cc', 'cxx', 'fc', 'mpicc', 'mpicxx', 'mpifort'];

// Register the root, bin, path and tool executable retrievers of a single toolchain environment
function registerEnvironment(name, env, pathSeparator, systemPath) {
	vscode.commands.registerCommand(`${name}.root`, function () {
		return env.root();
	});

	vscode.commands.registerCommand(`${name}.bin`, function () {
		return `${env.root()}/${env.bin}`;
	});

	vscode.commands.registerCommand(`${name}.path`, function () {
		return `${env.root()}/${env.bin}${pathSeparator}${systemPath}`;
	});

	for(const [tool, exe] of Object.entries(env.tools)) {
		vscode.commands.registerCommand(`${name}.${tool}.exe`, function () {
			const bin = `${env.root()}/${env.bin}`;
			return typeof exe == 'function' ? exe(bin) : `${bin}/${exe}`;
		});
	}
}

// Register the buildkit-generic retrievers delegating to the environment-specific ones
function registerBuildKitCommands(pathSeparator) {

	// Return buildkit-specific value or null if the buildkit is unrecognized
	const kitValue = suffix => BuildKit().then(kit => {
		return kit ? vscode.commands.executeCommand(`${kit}.${suffix}`) : null;
	});

	vscode.commands.registerCommand('cmake.buildkit.bin', function () {
		return kitValue('bin');
	});

	vscode.commands.registerCommand('cmake.buildkit.path', function () {
		return kitValue('path');
	});

	// System-specific value of the PATH environment variable for the launch tasks
	vscode.commands.registerCommand('cmake.buildkit.launch.path', function () {
		return vscode.commands.executeCommand('cmake.buildkit.path').then(path => {
			return vscode.commands.executeCommand('cmake.getLaunchTargetDirectory').then(targetDir => {
				return `${targetDir}${pathSeparator}${path}`;
			});
		});
	});

	vscode.commands.registerCommand('cmake.buildkit.generator.exe', function () {
		const gtor = vscode.workspace.getConfiguration().get('cmake.generator');
		if(gtor == undefined || /.*Makefiles/.test(gtor)) return BuildKitExe('make'); // TODO more elaborate make tool selection taking the build kit name into account
		else if(/Ninja.*/.test(gtor)) return BuildKitExe('ninja');
	});

	for(const tool of buildkitTools) {
		vscode.commands.registerCommand(`cmake.buildkit.${tool}.exe`, function () {
			return BuildKitExe(tool);
		});
	}
}

function activate(_context) {

	const pathSeparator = (process.platform == 'win32' ? ';' : ':');

	const rawPath = process.env.PATH || process.env.Path || '';
	const systemPath = rawPath.split(/\\?;/).join(pathSeparator); // Proper escaping of the system PATH

	registerBuildKitCommands(pathSeparator);

	for(const [name, env] of Object.entries(environments)) {
		registerEnvironment(name, env, pathSeparator, systemPath);
	}

	console.log('MSYS2 extension activated');

}

exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate
}

const vscode = require('vscode');

// Return canonic name of buildkit in effect or null if it is unrecognized
function BuildKit() {
	return vscode.commands.executeCommand('cmake.buildKit').then(kit => {
		if(/msys2?/i.test(kit)) return 'msys2';
		else if(/mingw\s*64/i.test(kit)) return 'mingw64';
		else if(/mingw\s*32/i.test(kit)) return 'mingw32';
		else if(/cygwin\s*64/i.test(kit)) return 'cygwin64';
		else if(/cygwin(\s*32)?/i.test(kit)) return 'cygwin32';
		else return null;
	});
};

// Return executable path for the buildkit in effect
function BuildKitExe(exe, fallback = null) {
	return BuildKit().then(kit => {
		return kit ? vscode.commands.executeCommand(`${kit}.${exe}.exe`) : Promise.resolve(fallback ? fallback : exe);
	});
}

function MinGWProvider(bit) {
	return vscode.workspace.getConfiguration().get(`mingw${bit}.root`) ? null : vscode.workspace.getConfiguration().get(`mingw${bit}.provider`);
}

function activate(context) {

	const pathSeparator = (process.platform == 'win32' ? '\;' : '\:');

	const systemPath = process.env.PATH.split(/\\?;/).join('\;'); // Proper escaping of the system PATH

	// BuildKit

	vscode.commands.registerCommand('cmake.buildkit.bin', function () {
		return BuildKit().then(kit => {
			return kit ? vscode.commands.executeCommand(`${kit}.bin`) : Promise.resolve(null);
		});
	});

	vscode.commands.registerCommand('cmake.buildkit.path', function () {
		return BuildKit().then(kit => {
			return kit ? vscode.commands.executeCommand(`${kit}.path`) : Promise.resolve(null);
		});
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

	vscode.commands.registerCommand('cmake.buildkit.cmake.exe', function () {
		return BuildKitExe('cmake');
	});

	vscode.commands.registerCommand('cmake.buildkit.ninja.exe', function () {
		return BuildKitExe('ninja');
	});

	vscode.commands.registerCommand('cmake.buildkit.make.exe', function () {
		return BuildKitExe('make');
	});

	vscode.commands.registerCommand('cmake.buildkit.gdb.exe', function () {
		return BuildKitExe('gdb');
	});

	vscode.commands.registerCommand('cmake.buildkit.cc.exe', function () {
		return BuildKitExe('cc', 'gcc');
	});

	vscode.commands.registerCommand('cmake.buildkit.cxx.exe', function () {
		return BuildKitExe('cxx', 'g++');
	});

	vscode.commands.registerCommand('cmake.buildkit.fc.exe', function () {
		return BuildKitExe('fc', 'gfortran');
	});

	// MSYS2

	vscode.commands.registerCommand('msys2.root', function () {
		return vscode.workspace.getConfiguration().get('msys2.root').replace('\\', '/');
	});

	vscode.commands.registerCommand('msys2.bin', function () {
		return vscode.commands.executeCommand('msys2.root').then(root => {return `${root}/usr/bin`;});
	});

	vscode.commands.registerCommand('msys2.path', function () {
		return vscode.commands.executeCommand('msys2.bin').then(binDir => {
			return `${binDir}${pathSeparator}${systemPath}`;
		});
	});

	vscode.commands.registerCommand('msys2.bash.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/bash.exe`;});
	});

	vscode.commands.registerCommand('msys2.gdb.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/gdb.exe`;});
	});

	vscode.commands.registerCommand('msys2.cmake.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/cmake.exe`;});
	});

	vscode.commands.registerCommand('msys2.make.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/make.exe`;});
	});

	vscode.commands.registerCommand('msys2.ninja.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/ninja.exe`;});
	});

	vscode.commands.registerCommand('msys2.cc.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/gcc.exe`;});
	});

	vscode.commands.registerCommand('msys2.cxx.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/g++.exe`;});
	});

	vscode.commands.registerCommand('msys2.fc.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/gfortran.exe`;});
	});

	// Cygwin32

	vscode.commands.registerCommand('cygwin32.root', function () {
		return vscode.workspace.getConfiguration().get('cygwin32.root').replace('\\', '/');
	});

	vscode.commands.registerCommand('cygwin32.bin', function () {
		return vscode.commands.executeCommand('cygwin32.root').then(root => {return `${root}/bin`;});
	});

	vscode.commands.registerCommand('cygwin32.path', function () {
		return vscode.commands.executeCommand('cygwin32.bin').then(binDir => {
			return `${binDir}${pathSeparator}${systemPath}`;
		});
	});

	vscode.commands.registerCommand('cygwin32.bash.exe', function () {
		return vscode.commands.executeCommand('cygwin32.bin').then(bin => {return `${bin}/bash.exe`;});
	});

	vscode.commands.registerCommand('cygwin32.gdb.exe', function () {
		return vscode.commands.executeCommand('cygwin32.bin').then(bin => {return `${bin}/gdb.exe`;});
	});

	vscode.commands.registerCommand('cygwin32.cmake.exe', function () {
		return vscode.commands.executeCommand('cygwin32.bin').then(bin => {return `${bin}/cmake.exe`;});
	});

	vscode.commands.registerCommand('cygwin32.make.exe', function () {
		return vscode.commands.executeCommand('cygwin32.bin').then(bin => {return `${bin}/make.exe`;});
	});

	vscode.commands.registerCommand('cygwin32.ninja.exe', function () {
		return vscode.commands.executeCommand('cygwin32.bin').then(bin => {return `${bin}/ninja.exe`;});
	});

	vscode.commands.registerCommand('cygwin32.cc.exe', function () {
		return vscode.commands.executeCommand('cygwin32.bin').then(bin => {return `${bin}/gcc.exe`;});
	});

	vscode.commands.registerCommand('cygwin32.cxx.exe', function () {
		return vscode.commands.executeCommand('cygwin32.bin').then(bin => {return `${bin}/g++.exe`;});
	});

	vscode.commands.registerCommand('cygwin32.fc.exe', function () {
		return vscode.commands.executeCommand('cygwin32.bin').then(bin => {return `${bin}/gfortran.exe`;});
	});

	// Cygwin64

	vscode.commands.registerCommand('cygwin64.root', function () {
		return vscode.workspace.getConfiguration().get('cygwin64.root').replace('\\', '/');
	});

	vscode.commands.registerCommand('cygwin64.bin', function () {
		return vscode.commands.executeCommand('cygwin64.root').then(root => {return `${root}/bin`;});
	});

	vscode.commands.registerCommand('cygwin64.path', function () {
		return vscode.commands.executeCommand('cygwin64.bin').then(binDir => {
			return `${binDir}${pathSeparator}${systemPath}`;
		});
	});

	vscode.commands.registerCommand('cygwin64.bash.exe', function () {
		return vscode.commands.executeCommand('cygwin64.bin').then(bin => {return `${bin}/bash.exe`;});
	});

	vscode.commands.registerCommand('cygwin64.gdb.exe', function () {
		return vscode.commands.executeCommand('cygwin64.bin').then(bin => {return `${bin}/gdb.exe`;});
	});

	vscode.commands.registerCommand('cygwin64.cmake.exe', function () {
		return vscode.commands.executeCommand('cygwin64.bin').then(bin => {return `${bin}/cmake.exe`;});
	});

	vscode.commands.registerCommand('cygwin64.make.exe', function () {
		return vscode.commands.executeCommand('cygwin64.bin').then(bin => {return `${bin}/make.exe`;});
	});

	vscode.commands.registerCommand('cygwin64.ninja.exe', function () {
		return vscode.commands.executeCommand('cygwin64.bin').then(bin => {return `${bin}/ninja.exe`;});
	});

	vscode.commands.registerCommand('cygwin64.cc.exe', function () {
		return vscode.commands.executeCommand('cygwin64.bin').then(bin => {return `${bin}/gcc.exe`;});
	});

	vscode.commands.registerCommand('cygwin64.cxx.exe', function () {
		return vscode.commands.executeCommand('cygwin64.bin').then(bin => {return `${bin}/g++.exe`;});
	});

	vscode.commands.registerCommand('cygwin64.fc.exe', function () {
		return vscode.commands.executeCommand('cygwin64.bin').then(bin => {return `${bin}/gfortran.exe`;});
	});

	// MinGW32

	vscode.commands.registerCommand('mingw32.root', function () {
		switch(prov = MinGWProvider(32)) {
			case 'msys2': return vscode.commands.executeCommand(`${prov}.root`).then(root => {return `${root}/mingw32`;});
			case 'cygwin32': case 'cygwin64': return vscode.commands.executeCommand(`${prov}.root`);
			default: return vscode.workspace.getConfiguration().get(`mingw32.root`).replace('\\', '/');
		}
	});

	vscode.commands.registerCommand('mingw32.bin', function () {
		return vscode.commands.executeCommand('mingw32.root').then(root => {return `${root}/bin`;});
	});

	vscode.commands.registerCommand('mingw32.path', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(binDir => {
			return `${binDir}${pathSeparator}${systemPath}`;
		});
	});

	vscode.commands.registerCommand('mingw32.gdb.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/gdb.exe`;});
	});

	vscode.commands.registerCommand('mingw32.cmake.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/cmake.exe`;});
	});

	vscode.commands.registerCommand('mingw32.make.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {
			return /cygwin.*/i.test(MinGWProvider(32)) ? `${bin}/make.exe` : `${bin}/mingw32-make.exe`;
		});
	});

	vscode.commands.registerCommand('mingw32.ninja.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/ninja.exe`;});
	});

	vscode.commands.registerCommand('mingw32.cc.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {
			return /cygwin.*/i.test(MinGWProvider(32)) ? `${bin}/i686-w64-mingw32-gcc.exe` : `${bin}/gcc.exe`;
		});
	});

	vscode.commands.registerCommand('mingw32.cxx.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {
			return /cygwin.*/i.test(MinGWProvider(32)) ? `${bin}/i686-w64-mingw32-g++.exe` : `${bin}/g++.exe`;
		});
	});

	vscode.commands.registerCommand('mingw32.fc.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {
			return /cygwin.*/i.test(MinGWProvider(32)) ? `${bin}/i686-w64-mingw32-gfortran.exe` : `${bin}/gfortran.exe`;
		});
	});

	// MinGW64

	vscode.commands.registerCommand('mingw64.root', function () {
		switch(prov = MinGWProvider(64)) {
			case 'msys2': return vscode.commands.executeCommand(`${prov}.root`).then(root => {return `${root}/mingw64`;});
			case 'cygwin32': case 'cygwin64': return vscode.commands.executeCommand(`${prov}.root`);
			default: return vscode.workspace.getConfiguration().get(`mingw64.root`).replace('\\', '/');
		}
	});

	vscode.commands.registerCommand('mingw64.bin', function () {
		return vscode.commands.executeCommand('mingw64.root').then(root => {return `${root}/bin`;});
	});

	vscode.commands.registerCommand('mingw64.path', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(binDir => {
			return `${binDir}${pathSeparator}${systemPath}`;
		});
	});

	vscode.commands.registerCommand('mingw64.gdb.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/gdb.exe`;});
	});

	vscode.commands.registerCommand('mingw64.cmake.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/cmake.exe`;});
	});

	vscode.commands.registerCommand('mingw64.make.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {
			return /cygwin.*/i.test(MinGWProvider(64)) ? `${bin}/make.exe` : `${bin}/mingw32-make.exe`;
		});
	});

	vscode.commands.registerCommand('mingw64.ninja.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/ninja.exe`;});
	});

	vscode.commands.registerCommand('mingw64.cc.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {
			return /cygwin.*/i.test(MinGWProvider(64)) ? `${bin}/x86_64-w64-mingw32-gcc.exe` : `${bin}/gcc.exe`;
		});
	});

	vscode.commands.registerCommand('mingw64.cxx.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {
			return /cygwin.*/i.test(MinGWProvider(64)) ? `${bin}/x86_64-w64-mingw32-g++.exe` : `${bin}/g++.exe`;
		});
	});

	vscode.commands.registerCommand('mingw64.fc.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {
			return /cygwin.*/i.test(MinGWProvider(64)) ? `${bin}/x86_64-w64-mingw32-gfortran.exe` : `${bin}/gfortran.exe`;
		});
	});

	console.log('MSYS2 extension activated');

}

exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate
}

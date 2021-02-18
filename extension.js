const vscode = require('vscode');

const msys2rx = /msys2?/i;
const mingw32rx = /mingw\s*32/i;
const mingw64rx = /mingw\s*64/i;
const cygwin32rx = /cygwin(\s*32)?/i;
const cygwin64rx = /cygwin\s*64/i;

const pathSeparator = (process.platform == 'win32' ? ';' : ':');

function BuildKit() {
	return vscode.commands.executeCommand('cmake.buildKit').then(kit => {
		if(msys2rx.test(kit)) {
			return 'msys2';
		} else if(mingw64rx.test(kit)) {
			return 'mingw64';
		} else if(mingw32rx.test(kit)) {
			return 'mingw32';
		} else if(cygwin64rx.test(kit)) {
			return 'cygwin64';
		} else if(cygwin32rx.test(kit)) {
			return 'cygwin32';
		} else return null;
	});
};

function BuildKitExe(exe, fallback = null) {
	return BuildKit().then(kit => {
		return kit ? vscode.commands.executeCommand(`${kit}.${exe}.exe`).then(exe => {return exe;}) : Promise.resolve(fallback ? fallback : exe);
	});
}

function activate(context) {

	// BuildKit

	vscode.commands.registerCommand('cmake.buildkit.bin', function () {
		return BuildKit().then(kit => {
			return kit ? vscode.commands.executeCommand(`${kit}.bin`).then(bin => {return bin;}) : Promise.resolve('');
		});
	});

	// System-specific value of the PATH environment variable for the launch tasks
	vscode.commands.registerCommand('cmake.buildkit.launch.path', function () {
		return vscode.commands.executeCommand('cmake.buildkit.bin').then(binDir => {
			return vscode.commands.executeCommand('cmake.getLaunchTargetDirectory').then(targetDir => {
				return `${targetDir}${pathSeparator}${binDir}${pathSeparator}\$PATH`;
			});
		});
	});

	vscode.commands.registerCommand('cmake.buildkit.cmake.exe', function () {
		return BuildKitExe('cmake').then(exe => {return exe;});
	});

	vscode.commands.registerCommand('cmake.buildkit.ninja.exe', function () {
		return BuildKitExe('ninja').then(exe => {return exe;});
	});

	vscode.commands.registerCommand('cmake.buildkit.make.exe', function () {
		return BuildKitExe('make').then(exe => {return exe;});
	});

	vscode.commands.registerCommand('cmake.buildkit.gdb.exe', function () {
		return BuildKitExe('gdb').then(exe => {return exe;});
	});

	vscode.commands.registerCommand('cmake.buildkit.cc.exe', function () {
		return BuildKitExe('cc', 'gcc').then(exe => {return exe;});
	});

	vscode.commands.registerCommand('cmake.buildkit.cxx.exe', function () {
		return BuildKitExe('cxx', 'g++').then(exe => {return exe;});
	});

	vscode.commands.registerCommand('cmake.buildkit.fc.exe', function () {
		return BuildKitExe('fc', 'gfortran').then(exe => {return exe;});
	});

	// MSYS2

	vscode.commands.registerCommand('msys2.root', function () {
		return vscode.workspace.getConfiguration().get('msys2.root').replace('\\', '/');
	});

	vscode.commands.registerCommand('msys2.bin', function () {
		return vscode.commands.executeCommand('msys2.root').then(root => {return `${root}/usr/bin`;});
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
		const mingw = vscode.workspace.getConfiguration().get('mingw32.root');
		return mingw ? mingw.replace('\\', '/') : vscode.commands.executeCommand('msys2.root').then(root => {return `${root}/mingw32`;});
	});

	vscode.commands.registerCommand('mingw32.bin', function () {
		return vscode.commands.executeCommand('mingw32.root').then(root => {return `${root}/bin`;});
	});

	vscode.commands.registerCommand('mingw32.gdb.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/gdb.exe`;});
	});

	vscode.commands.registerCommand('mingw32.cmake.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/cmake.exe`;});
	});

	vscode.commands.registerCommand('mingw32.make.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/mingw32-make.exe`;});
	});

	vscode.commands.registerCommand('mingw32.ninja.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/ninja.exe`;});
	});

	vscode.commands.registerCommand('mingw32.cc.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/gcc.exe`;});
	});

	vscode.commands.registerCommand('mingw32.cxx.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/g++.exe`;});
	});

	vscode.commands.registerCommand('mingw32.fc.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/gfortran.exe`;});
	});

	// MinGW64

	vscode.commands.registerCommand('mingw64.root', function () {
		const mingw = vscode.workspace.getConfiguration().get('mingw64.root');
		return mingw ? mingw.replace('\\', '/') : vscode.commands.executeCommand('msys2.root').then(root => {return `${root}/mingw64`;});
	});

	vscode.commands.registerCommand('mingw64.bin', function () {
		return vscode.commands.executeCommand('mingw64.root').then(root => {return `${root}/bin`;});
	});

	vscode.commands.registerCommand('mingw64.gdb.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/gdb.exe`;});
	});

	vscode.commands.registerCommand('mingw64.cmake.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/cmake.exe`;});
	});

	vscode.commands.registerCommand('mingw64.make.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/mingw32-make.exe`;});
	});

	vscode.commands.registerCommand('mingw64.ninja.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/ninja.exe`;});
	});

	vscode.commands.registerCommand('mingw64.cc.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/gcc.exe`;});
	});

	vscode.commands.registerCommand('mingw64.cxx.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/g++.exe`;});
	});

	vscode.commands.registerCommand('mingw64.fc.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/gfortran.exe`;});
	});

	console.log('MSYS2 support activated');

}

exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate
}

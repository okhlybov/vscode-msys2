const vscode = require('vscode');

const msys2rx = /msys2?/i;
const mingw32rx = /mingw\s*32/i;
const mingw64rx = /mingw\s*64/i;

function BuildKit() {
	return vscode.commands.executeCommand('cmake.buildKit').then(kit => {
		if(msys2rx.test(kit)) {
			return 'msys2';
		} else if(mingw32rx.test(kit)) {
			return 'mingw32';
		} else if(mingw64rx.test(kit)) {
			return 'mingw64';
		} else return null;
	});
};

function BuildKitExe(exe) {
	return BuildKit().then(kit => {
		switch(kit) {
			case 'msys2': return vscode.commands.executeCommand(`msys2.${exe}.exe`).then(exe => {return exe;});
			case 'mingw32': return vscode.commands.executeCommand(`mingw32.${exe}.exe`).then(exe => {return exe;});
			case 'mingw64': return vscode.commands.executeCommand(`mingw64.${exe}.exe`).then(exe => {return exe;});
			default: return Promise.resolve(null);
		}
	});
}

function activate(context) {

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

	vscode.commands.registerCommand('msys2.root', function () {
		return vscode.workspace.getConfiguration().get('msys2.root');
	});

	vscode.commands.registerCommand('msys2.usr.bin', function () {
		return vscode.commands.executeCommand('msys2.root').then(root => {return `${root}\\usr\\bin`;});
	});

	vscode.commands.registerCommand('msys2.bash.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\bash.exe`;});
	});

	vscode.commands.registerCommand('msys2.gdb.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\gdb.exe`;});
	});

	vscode.commands.registerCommand('msys2.cmake.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\cmake.exe`;});
	});

	vscode.commands.registerCommand('msys2.make.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\make.exe`;});
	});

	vscode.commands.registerCommand('msys2.ninja.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\ninja.exe`;});
	});

	vscode.commands.registerCommand('msys2.cc.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\gcc.exe`;});
	});

	vscode.commands.registerCommand('msys2.cxx.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\g++.exe`;});
	});

	vscode.commands.registerCommand('msys2.fc.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\gfortran.exe`;});
	});

	vscode.commands.registerCommand('mingw32.root', function () {
		const mingw = vscode.workspace.getConfiguration().get('mingw32.root');
		return mingw ? mingw : vscode.commands.executeCommand('msys2.root').then(root => {return `${root}\\mingw32`;});
	});

	vscode.commands.registerCommand('mingw32.bin', function () {
		return vscode.commands.executeCommand('mingw32.root').then(root => {return `${root}\\bin`;});
	});

	vscode.commands.registerCommand('mingw32.gdb.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}\\gdb.exe`;});
	});

	vscode.commands.registerCommand('mingw32.cmake.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}\\cmake.exe`;});
	});

	vscode.commands.registerCommand('mingw32.make.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}\\mingw32-make.exe`;});
	});

	vscode.commands.registerCommand('mingw32.ninja.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}\\ninja.exe`;});
	});

	vscode.commands.registerCommand('mingw32.cc.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}\\gcc.exe`;});
	});

	vscode.commands.registerCommand('mingw32.cxx.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}\\g++.exe`;});
	});

	vscode.commands.registerCommand('mingw32.fc.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}\\gfortran.exe`;});
	});

	vscode.commands.registerCommand('mingw64.root', function () {
		const mingw = vscode.workspace.getConfiguration().get('mingw64.root');
		return mingw ? mingw : vscode.commands.executeCommand('msys2.root').then(root => {return `${root}\\mingw64`;});
	});

	vscode.commands.registerCommand('mingw64.bin', function () {
		return vscode.commands.executeCommand('mingw64.root').then(root => {return `${root}\\bin`;});
	});

	vscode.commands.registerCommand('mingw64.gdb.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}\\gdb.exe`;});
	});

	vscode.commands.registerCommand('mingw64.cmake.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}\\cmake.exe`;});
	});

	vscode.commands.registerCommand('mingw64.make.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}\\mingw32-make.exe`;});
	});

	vscode.commands.registerCommand('mingw64.ninja.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}\\ninja.exe`;});
	});

	vscode.commands.registerCommand('mingw64.cc.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}\\gcc.exe`;});
	});

	vscode.commands.registerCommand('mingw64.cxx.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}\\g++.exe`;});
	});

	vscode.commands.registerCommand('mingw64.fc.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}\\gfortran.exe`;});
	});

	console.log('MSYS2 support activated');

}

exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate
}

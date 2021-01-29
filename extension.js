const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	vscode.commands.registerCommand('msys2.root', function () {
		return vscode.workspace.getConfiguration().get('msys2.root');
	});

	vscode.commands.registerCommand('msys2.usr.bin', function () {
		return vscode.commands.executeCommand('msys2.root').then(root => {return `${root}\\usr\\bin`;});
	});

	vscode.commands.registerCommand('msys2.bash.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\bash.exe`;});
	});

	vscode.commands.registerCommand('msys2.cmake.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\cmake.exe`;});
	});

	vscode.commands.registerCommand('msys2.ninja.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {return `${bin}\\ninja.exe`;});
	});

	vscode.commands.registerCommand('mingw32.root', function () {
		const mingw = vscode.workspace.getConfiguration().get('mingw32.root');
		if(mingw == null) {
			return vscode.commands.executeCommand('msys2.root').then(root => {return `${root}\\mingw32`;});
		} else {
			return mingw;
		}
	});

	vscode.commands.registerCommand('mingw32.bin', function () {
		return vscode.commands.executeCommand('mingw32.root').then(root => {return `${root}\\bin`;});
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
		if(mingw == null) {
			return vscode.commands.executeCommand('msys2.root').then(root => {return `${root}\\mingw64`;});
		} else {
			return mingw;
		}
	});

	vscode.commands.registerCommand('mingw64.bin', function () {
		return vscode.commands.executeCommand('mingw64.root').then(root => {return `${root}\\bin`;});
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

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "msys2" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('msys2.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from msys2!');
	});

	vscode.commands.registerCommand('msys2.root', function () {
		return vscode.workspace.getConfiguration().get('msys2.root');
	});

	vscode.commands.registerCommand('msys2.usr.bin', function () {
		return vscode.commands.executeCommand('msys2.root').then(root => {
			return `${root}\\usr\\bin`;
		});
	});

	vscode.commands.registerCommand('msys2.cmake.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {
			return `${bin}\\cmake.exe`;
		});
	});

	vscode.commands.registerCommand('msys2.ninja.exe', function () {
		return vscode.commands.executeCommand('msys2.usr.bin').then(bin => {
			return `${bin}\\ninja.exe`;
		});
	});

	vscode.commands.registerCommand('mingw32.root', function () {
		const mingw = vscode.workspace.getConfiguration().get('mingw32.root');
		if(mingw == null) {
			return vscode.commands.executeCommand('msys2.root').then(root => {
				return `${root}\\mingw32`;
			});
		} else {
			return mingw;
		}
	});

	vscode.commands.registerCommand('mingw32.bin', function () {
		return vscode.commands.executeCommand('mingw32.root').then(root => {
			return `${root}\\bin`;
		});
	});

	vscode.commands.registerCommand('mingw32.cc.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {
			return `${bin}\\gcc.exe`;
		});
	});

	vscode.commands.registerCommand('mingw32.cxx.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {
			return `${bin}\\g++.exe`;
		});
	});

	vscode.commands.registerCommand('mingw32.fc.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {
			return `${bin}\\gfortran.exe`;
		});
	});

	vscode.commands.registerCommand('mingw64.root', function () {
		const mingw = vscode.workspace.getConfiguration().get('mingw64.root');
		if(mingw == null) {
			return vscode.commands.executeCommand('msys2.root').then(root => {
				return `${root}\\mingw64`;
			});
		} else {
			return mingw;
		}
	});

	vscode.commands.registerCommand('mingw64.bin', function () {
		return vscode.commands.executeCommand('mingw64.root').then(root => {
			return `${root}\\bin`;
		});
	});

	vscode.commands.registerCommand('mingw64.cc.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {
			return `${bin}\\gcc.exe`;
		});
	});

	vscode.commands.registerCommand('mingw64.cxx.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {
			return `${bin}\\g++.exe`;
		});
	});

	vscode.commands.registerCommand('mingw64.fc.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {
			return `${bin}\\gfortran.exe`;
		});
	});

	context.subscriptions.push(disposable);

	vscode.commands.executeCommand('mingw64.fc.exe').then(value => {
		console.log(value);
	});
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}

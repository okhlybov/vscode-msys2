const vscode = require('vscode');

// Return canonic name of buildkit in effect or null if it is unrecognized
function BuildKit() {
	return vscode.commands.executeCommand('cmake.buildKit').then(kit => {
		if(/msys2?/i.test(kit)) return 'msys2';
		else if(/ucrt\s*64/i.test(kit)) return 'ucrt64';
		else if(/mingw\s*64/i.test(kit)) return 'mingw64';
		else if(/mingw\s*32/i.test(kit)) return 'mingw32';
		else if(/clang\s*64/i.test(kit)) return 'clang64';
		else if(/clang\s*32/i.test(kit)) return 'clang32';
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

	vscode.commands.registerCommand('cmake.buildkit.meson.exe', function () {
		return BuildKitExe('meson');
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
		return BuildKitExe('cc');
	});

	vscode.commands.registerCommand('cmake.buildkit.cxx.exe', function () {
		return BuildKitExe('cxx');
	});

	vscode.commands.registerCommand('cmake.buildkit.fc.exe', function () {
		return BuildKitExe('fc');
	});

	vscode.commands.registerCommand('cmake.buildkit.mpicc.exe', function () {
		return BuildKitExe('mpicc');
	});

	vscode.commands.registerCommand('cmake.buildkit.mpicxx.exe', function () {
		return BuildKitExe('mpicxx');
	});

	vscode.commands.registerCommand('cmake.buildkit.mpifort.exe', function () {
		return BuildKitExe('mpifort');
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

	vscode.commands.registerCommand('msys2.meson.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/meson.exe`;});
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

	vscode.commands.registerCommand('msys2.mpicc.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/mpicc.exe`;});
	});

	vscode.commands.registerCommand('msys2.mpicxx.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/mpicxx.exe`;});
	});

	vscode.commands.registerCommand('msys2.mpifort.exe', function () {
		return vscode.commands.executeCommand('msys2.bin').then(bin => {return `${bin}/mpifort.exe`;});
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

	vscode.commands.registerCommand('cygwin32.meson.exe', function () {
		return vscode.commands.executeCommand('cygwin32.bin').then(bin => {return `${bin}/meson.exe`;});
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

	vscode.commands.registerCommand('cygwin64.meson.exe', function () {
		return vscode.commands.executeCommand('cygwin64.bin').then(bin => {return `${bin}/meson.exe`;});
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

	vscode.commands.registerCommand('mingw32.meson.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/meson.exe`;});
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

	vscode.commands.registerCommand('mingw32.mpicc.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/mpicc.exe`;});
	});

	vscode.commands.registerCommand('mingw32.mpicxx.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/mpicxx.exe`;});
	});

	vscode.commands.registerCommand('mingw32.mpifort.exe', function () {
		return vscode.commands.executeCommand('mingw32.bin').then(bin => {return `${bin}/mpifort.exe`;});
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

	vscode.commands.registerCommand('mingw64.meson.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/meson.exe`;});
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
	
  vscode.commands.registerCommand('mingw64.mpicc.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/mpicc.exe`;});
	});

	vscode.commands.registerCommand('mingw64.mpicxx.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/mpicxx.exe`;});
	});

	vscode.commands.registerCommand('mingw64.mpifort.exe', function () {
		return vscode.commands.executeCommand('mingw64.bin').then(bin => {return `${bin}/mpifort.exe`;});
	});

	// Clang32

	vscode.commands.registerCommand('clang32.root', function () {
		return vscode.commands.executeCommand(`msys2.root`).then(root => {return `${root}/clang32`;});
	});

	vscode.commands.registerCommand('clang32.bin', function () {
		return vscode.commands.executeCommand('clang32.root').then(root => {return `${root}/bin`;});
	});

	vscode.commands.registerCommand('clang32.path', function () {
		return vscode.commands.executeCommand('clang32.bin').then(binDir => {
			return `${binDir}${pathSeparator}${systemPath}`;
		});
	});

	vscode.commands.registerCommand('clang32.gdb.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {return `${bin}/gdb.exe`;});
	});

	vscode.commands.registerCommand('clang32.cmake.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {return `${bin}/cmake.exe`;});
	});

	vscode.commands.registerCommand('clang32.meson.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {return `${bin}/meson.exe`;});
	});

	vscode.commands.registerCommand('clang32.make.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {
			return `${bin}/mingw32-make.exe`;
		});
	});

	vscode.commands.registerCommand('clang32.ninja.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {return `${bin}/ninja.exe`;});
	});

	vscode.commands.registerCommand('clang32.cc.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {
			return `${bin}/clang.exe`;
		});
	});

	vscode.commands.registerCommand('clang32.cxx.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {
			return `${bin}/clang++.exe`;
		});
	});

	vscode.commands.registerCommand('clang32.fc.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {
			return `${bin}/flang.exe`;
		});
	});

  vscode.commands.registerCommand('clang32.mpicc.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {return `${bin}/mpicc.exe`;});
	});

	vscode.commands.registerCommand('clang32.mpicxx.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {return `${bin}/mpicxx.exe`;});
	});

	vscode.commands.registerCommand('clang32.mpifort.exe', function () {
		return vscode.commands.executeCommand('clang32.bin').then(bin => {return `${bin}/mpifort.exe`;});
	});

  // Clang64

	vscode.commands.registerCommand('clang64.root', function () {
		return vscode.commands.executeCommand(`msys2.root`).then(root => {return `${root}/clang64`;});
	});

	vscode.commands.registerCommand('clang64.bin', function () {
		return vscode.commands.executeCommand('clang64.root').then(root => {return `${root}/bin`;});
	});

	vscode.commands.registerCommand('clang64.path', function () {
		return vscode.commands.executeCommand('clang64.bin').then(binDir => {
			return `${binDir}${pathSeparator}${systemPath}`;
		});
	});

	vscode.commands.registerCommand('clang64.gdb.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {return `${bin}/gdb.exe`;});
	});

	vscode.commands.registerCommand('clang64.cmake.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {return `${bin}/cmake.exe`;});
	});

	vscode.commands.registerCommand('clang64.meson.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {return `${bin}/meson.exe`;});
	});

	vscode.commands.registerCommand('clang64.make.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {
			return `${bin}/mingw32-make.exe`;
		});
	});

	vscode.commands.registerCommand('clang64.ninja.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {return `${bin}/ninja.exe`;});
	});

	vscode.commands.registerCommand('clang64.cc.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {
			return `${bin}/clang.exe`;
		});
	});

	vscode.commands.registerCommand('clang64.cxx.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {
			return `${bin}/clang++.exe`;
		});
	});

	vscode.commands.registerCommand('clang64.fc.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {
			return `${bin}/flang.exe`;
		});
	});

  vscode.commands.registerCommand('clang64.mpicc.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {return `${bin}/mpicc.exe`;});
	});

	vscode.commands.registerCommand('clang64.mpicxx.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {return `${bin}/mpicxx.exe`;});
	});

	vscode.commands.registerCommand('clang64.mpifort.exe', function () {
		return vscode.commands.executeCommand('clang64.bin').then(bin => {return `${bin}/mpifort.exe`;});
	});

  // UCRT64

	vscode.commands.registerCommand('ucrt64.root', function () {
		return vscode.commands.executeCommand(`msys2.root`).then(root => {return `${root}/ucrt64`;});
	});

	vscode.commands.registerCommand('ucrt64.bin', function () {
		return vscode.commands.executeCommand('ucrt64.root').then(root => {return `${root}/bin`;});
	});

	vscode.commands.registerCommand('ucrt64.path', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(binDir => {
			return `${binDir}${pathSeparator}${systemPath}`;
		});
	});

	vscode.commands.registerCommand('ucrt64.gdb.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {return `${bin}/gdb.exe`;});
	});

	vscode.commands.registerCommand('ucrt64.cmake.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {return `${bin}/cmake.exe`;});
	});

	vscode.commands.registerCommand('ucrt64.meson.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {return `${bin}/meson.exe`;});
	});

	vscode.commands.registerCommand('ucrt64.make.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {
			return `${bin}/mingw32-make.exe`;
		});
	});

	vscode.commands.registerCommand('ucrt64.ninja.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {return `${bin}/ninja.exe`;});
	});

	vscode.commands.registerCommand('ucrt64.cc.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {
			return `${bin}/gcc.exe`;
		});
	});

	vscode.commands.registerCommand('ucrt64.cxx.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {
			return `${bin}/g++.exe`;
		});
	});

	vscode.commands.registerCommand('ucrt64.fc.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {
			return `${bin}/gfortran.exe`;
		});
	});

  vscode.commands.registerCommand('ucrt64.mpicc.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {return `${bin}/mpicc.exe`;});
	});

	vscode.commands.registerCommand('ucrt64.mpicxx.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {return `${bin}/mpicxx.exe`;});
	});

	vscode.commands.registerCommand('ucrt64.mpifort.exe', function () {
		return vscode.commands.executeCommand('ucrt64.bin').then(bin => {return `${bin}/mpifort.exe`;});
	});

  //
  
	console.log('MSYS2 extension activated');

}

exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate
}

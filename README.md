# MSYS2 support extension for Visual Studio Code 

This extension brings in configuration and usage of the [MSYS2](https://www.msys2.org/) & [MinGW](http://mingw-w64.org) toolchains to [Visual Studio Code](https://code.visualstudio.com/).

## Features

- [CMakeTools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cmake-tools) integration via CMake Kits

- [CppTools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) integration

- Isolated operation where no global PATH modification is neccessary

## Requirements

- 64-bit Windows 7+

- 64-bit MSYS2 installation

- 32/64-bit MinGW installations

## Setup & Configuration

This extension is primarily designed to work with the CMakeTools extension.

The following steps are to be performed in order to configure a minimal useable MSYS2, MinGW and Visual Studio Code environments.

### MSYS2 & MinGW installation

### Per user Visual Studio Code extensions

The following extension are required to be installed

```
ms-vscode.cmake-tools ms-vscode.cpptools fougas.msys2
```

by opening the Visual Studio Code extensions panel with the **`Ctrl+Shift+X`** keyboard shortcut and pasting the above line into the dialog, then installing each of discovered extensions individually.

Next come optional but recommended extensions which enhance the usage experience

```
twxs.cmake
```

### Per user Visual Studio Code configuration

The basic per user extension configuration is performed by issuing the keyboard shortcut **`Ctrl+,`** and pasting the below configuration to the `settings.json` configuration file.

**Note** that in case of existing configuration the above JSON configuration should not be pasted verbatim. Instead, the keys inside the outer {} braces should be appended to configuration.


#### MSYS2 & MinGW configuration

The MSYS2 location is specified by the `msys2.root` configuration option in  the `settings.json` configuration file. It can be modified either from the VisualStudio Code UI configurator accessed with the keyboard shortcut **`Ctrl+,`** or by editing the `settings.json` file directly. By default the `msys2.root` is set to `c:\msys64` which is the default location proposed by the MSYS2 installer.

The 32/64-bit MinGW locations are specified by the respective `mingw32.root` and `mingw64.root` configuration options. If not set, their values will be computed according to the `msys2.root` value, hence there is no need to coupe with them in order to use the MSYS2-provided MinGW installation.

#### CMake & generator configuration

The following configuration settings are to be added to the per user `settings.json`:

```json
{
  "cmake.cmakePath": "${command:cmake.buildkit.cmake.exe}",
  "cmake.generator": "Ninja Multi-Config",
  "cmake.configureSettings": {
      "CMAKE_MAKE_PROGRAM": "${command:cmake.buildkit.ninja.exe}",
      "CMAKE_VERBOSE_MAKEFILE": true
  }
}
```

The above settings set preferred [Ninja](https://ninja-build.org/) as the generator tool thus enabling to build with either MSYS2 or MinGW toolchains with no settings modification required. The actual paths to executables are kept in sync with the CMakeTools build kit in effect.

It is also possible to revert to a more common [GNU Make](https://www.gnu.org/software/make/) at a cost of losing the build kit neutrality as MSYS2 and MinGW toolchains have different generator names.

The `CMAKE_VERBOSE_MAKEFILE` parameter is optional and defaults to **false** when omitted. When set to **true** the generated makefiles output the command lines being executed.

#### CMakeTools integration

In order to configure per user MSYS2-specific CMakeTools [Kits](https://github.com/microsoft/vscode-cmake-tools/blob/develop/docs/kits.md), issue the command **`Ctrl+Shift+P` |> CMake: Edit User-Local CMake Kits** and paste the configuration below

```json
[
  {
    "name": "MinGW32",
    "environmentVariables": {"PATH": "${command:mingw32.bin}"},
    "compilers": {
      "C": "${command:mingw32.cc.exe}",
      "CXX": "${command:mingw32.cxx.exe}",
      "Fortran": "${command:mingw32.fc.exe}"
    },
    "keep": true
  },
  {
    "name": "MinGW64",
    "environmentVariables": {"PATH": "${command:mingw64.bin}"},
    "compilers": {
      "C": "${command:mingw64.cc.exe}",
      "CXX": "${command:mingw64.cxx.exe}",
      "Fortran": "${command:mingw64.fc.exe}"
    },
    "keep": true
  },
  {
    "name": "MSYS2",
    "environmentVariables": {"PATH": "${command:msys2.bin}"},
    "compilers": {
      "C": "${command:msys2.cc.exe}",
      "CXX": "${command:msys2.cxx.exe}",
      "Fortran": "${command:msys2.fc.exe}"
    },
    "keep": true
  }
]
```

**Note** that the above configuration command is only available when the CMakeTools extension is active, e.g. when a CMake project is open.

#### CppTools integration

In order to configure the per project `.vscode/launch.json` configuration which plays nicely with the [CppTools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) debugging funcionality, issue the command **`Ctrl+Shift+P` |> Open launch.json** and paste the configuration below

```json
{
    "version": "0.2.0",
    "configurations": [
        
        {
            "name": "(gdb) Launch",
            "type": "cppdbg",
            "request": "launch",
            "program": "${command:cmake.launchTargetPath}",
            "args": [],
            "stopAtEntry": false,
            "cwd": "${workspaceFolder}",
            "environment": [
                {
                    "name": "PATH",
                    "value": "${command:cmake.buildkit.launch.path}"
                }
            ],
            "externalConsole": true,
            "MIMode": "gdb",
            "miDebuggerPath": "${command:cmake.buildkit.gdb.exe}",
            "setupCommands": [
                {
                    "description": "Enable pretty-printing for gdb",
                    "text": "-enable-pretty-printing",
                    "ignoreFailures": true
                }
            ]
        }
    ]
}
```

This runs the GDB debugger specific to the CMake build kit currently in effect.
Also, it sets up the PATH environment variable to include both executable directory and toolchain binary directory for launcher to reach all the required dynamic libraries.

## Known issues & caveats

[0.1.0] The integrated terminal `terminal.integrated.shell.windows` setting so far does not actually perform command substitution effectively precluding the use of the package-provided `msys2.bash.exe` command to obtain the actual path to Bash executable.

[0.2.0] When switching between the CMakeTools build kits within a single work session, the CMake `cmake.cmakePath` property is not re-evaluated even in spite of the requested command interpolation (`${command:cmake.buildkit.cmake.exe}`, for example). As a result, a previous kit's value will be reused. In order to synchronize its value, a session restart is required. On the contrary, a generator tool specified by the `cmake.configureSettings` property gets updated correctly.
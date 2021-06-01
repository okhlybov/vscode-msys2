# MSYS2/Cygwin/MinGW support extension for Visual Studio Code 

This extension brings in configuration and usage of the [MSYS2](https://www.msys2.org/), [Cygwin](https://cygwin.com/) and [MinGW](http://mingw-w64.org) toolchains to the [Visual Studio Code](https://code.visualstudio.com/).

Technically the extension provides a set of commands for use with the `${command:...}` substitution feature used throughout the VS Code and its extensions to enhance their configurability. These commands return full paths to the respective toolchain-specific executables such as the CMake itself, generators, compilers etc.

## Features

- [CMakeTools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cmake-tools) integration

  - 32/64 bit MSYS2/Cygwin/MinGW toolchain configurations

- [CppTools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) integration

  - Cross-language [debugging with GDB](https://code.visualstudio.com/docs/cpp/cpp-debug)

  - Code navigation with [IntelliSense](https://code.visualstudio.com/docs/editor/intellisense)

- Isolated operation where no global PATH modification is neccessary

- Support for MSVCRT-based and UCRT-based MinGW toolchains provided by MSYS2

## Setup & Configuration

This extension is primarily designed to work with the CMakeTools extension although it is possible to make use of it with any build system which utilizes the command substitution capability.

The following steps are to be performed in order to configure a minimal usable MSYS2, Cygwin MinGW and Visual Studio Code environments.

**Hint** the VS Code canonic `Ctrl+Shift+P` command palette shortcut extensively used below has a very convenient `F1` alias.

### Per user Visual Studio Code extensions

The following extensions are to be installed

```
ms-vscode.cmake-tools ms-vscode.cpptools fougas.msys2
```

by opening the [Visual Studio Code extensions](https://code.visualstudio.com/docs/editor/extension-gallery) panel with the **`Ctrl+Shift+X`** keyboard shortcut and pasting the above line into the entry, then installing each of highlighted extensions individually.

Next come optional yet recommended extensions which enhance the usage experience

```
twxs.cmake krvajalm.linter-gfortran
```

which provide the CMake and Fortran file syntax highlighting, respectively.

### Per user Visual Studio Code configuration

Currently the MSYS2 extension provides no means of auto-detecting the supported toolchain locations.

Instead, it is configured manually via the per user [configuration settings](https://code.visualstudio.com/docs/getstarted/settings) specified in the `settings.json` configuration file.
These settings can be set either via the UI or by direct editing the `settings.json` file in the form of raw JSON data.
In either case, the settings are accessible via the **`Ctrl+,`** keyboard shortcut.

#### MSYS2 & MinGW configuration

The (64-bit) MSYS2 location is specified by the `msys2.root` configuration setting in the `settings.json` file which is set to `c:\msys64` by default as it is the default location proposed by the MSYS2 installer. This specifically means that no manual configuration is required when MSYS2 is installed into default location.

The 32/64-bit MinGW locations are specified by the respective `mingw32.root` and `mingw64.root` configuration settings. If not set, their values will be computed according to the `msys2.root` value, hence there is no need to coupe with them in order to use the MSYS2-provided MinGW installations.

#### Cygwin configuration

The 32/64-bit Cygwin locations are specified by the `cygwin32.root` and `cygwin64.root` configuration settings in the `settings.json` file which are set to `c:\cygwin` and `c:\cygwin64` by default, respectively, as they are the default locations proposed by the Cygwin installers.

**Note** that in order to use the Cygwin-provided MinGW toolchains the `mingw*.root` configuration settings are to be set manually.

#### MinGW selection

The MSYS2 extension offers selection of the source the MinGW toolchain comes from.

There are three implemented MinGW providers:

- MSYS2

- Cygwin

- Standalone MinGW

The MinGW selection logics works as follows.
If the `mingw??.root` configuration setting is set, it is used to determine the root path to the standalone MinGW installation such as [MinGW-W64](http://mingw-w64.org) or [TDM-GCC](https://jmeubank.github.io/tdm-gcc/).
Otherwise, the `mingw??.provider` configuration setting is used to determine the MinGW provider. There are four possible values for it: `msys2`, `cygwin32`, `cygwin64` and anything else with `msys2` taken as the default. If it is set to anything but the first three, the selector falls back to the above `mingw??.root` case.
32 and 64-bit MinGW installations are determined separately with the respective configuration settings.

##### MinGW runtimes

There are two different C runtimes supported by the MinGW: the traditional MSVCRT-based runtime and the Microsoft's new [universal C runtime](https://docs.microsoft.com/cpp/windows/universal-crt-deployment). 

Modern MSYS2 provides support for both of them. Moreover, both versions do happily coexist within the MSYS2 installation inside `{msys2.root}/mingw??` and `{msys2.root}/ucrt64` directories, respectively.

This MSYS2 extension allows to select particular MinGW kit for use by the CMakeTools: the MSVCRT-based builds are accessible via the **MinGW32** and **MinGW64** kits and the 64-bit UCRT-based build is accessible via the **UCRT64** kit (note that there is no 32-bit UCRT).

As the UCRT-based build is bound to the MSYS2 installation there is no particular configuration for it.

#### CMake & generator configuration

The CMakeTools-specific configuration is normally done per user by editing the `settings.json` file either manually or through the VS Code's UI. There are two parts which are to be configured: the CMake itself and the CMake's [generator tool](https://cmake.org/cmake/help/latest/manual/cmake-generators.7.html). While it is sufficient to set the `cmake.cmakePath` configuration setting for the CMake part, the latter is a more involved. Of all CMake-supported generators there are two useful ones: [GNU Make](https://www.gnu.org/software/make/) Makefile and [Ninja](https://ninja-build.org/) generators with the latter being strongly recommended.

**Note** that any changes to the generator settings will most likely require reloading the VS Code window **and** project reconfiguration afterwards (see the Troubleshooting section below).

##### Makefile generator configuration

Even though the Ninja is a recommended generator, the Makefile generator is a default one (for a reason). While perfectly useful, the Makefile generator suffers from the naming problem which hinders the configuration's platform independence: there are different Makefile generators for different environments. Specifically, the MSYS2's generator is named `MSYS Makefiles`, the MinGW's is named `MinGW Makefiles` while Cygwin and WSL share the same `Unix Makefiles` generator with all three producing **incompatible** Makefiles.

To overcome this problem the MSYS2 extension's configuration relies on default generator selection mechanism implemented in the CMakeTools. For this to work, the `cmake.generator` configuration setting must be **unset** as shown in the following `settings.json` configuration file.

```json
{
  "cmake.cmakePath": "${command:cmake.buildkit.cmake.exe}",
  "cmake.preferredGenerators": ["Unix Makefiles"],
  "cmake.configureSettings": {
      "CMAKE_MAKE_PROGRAM": "${command:cmake.buildkit.generator.exe}",
      "CMAKE_VERBOSE_MAKEFILE": false
  }
}
```

This configuration is expected to work unchanged across all supported environments: native Windows (MinGW), unixized Windows (MSYS2, Cygwin) and managed Linux (WSL, WSL2).

##### Ninja generator configuration

The Ninja generator configuration is an extension to the Makefile generator's with the explicit `cmake.generator` setting being the only addition:


```json
{
  "cmake.generator": "Ninja",
  "cmake.cmakePath": "${command:cmake.buildkit.cmake.exe}",
  "cmake.preferredGenerators": ["Unix Makefiles"],
  "cmake.configureSettings": {
      "CMAKE_MAKE_PROGRAM": "${command:cmake.buildkit.generator.exe}",
      "CMAKE_VERBOSE_MAKEFILE": false
  }
}
```

This way the hop between Makefile and Ninja is just a `cmake.generator` configuration setting away.

##### Multi-Config Ninja generator configuration

This is the most comfortable generator to use with CMake as it accounts for the fast switching between different build types (Debug/Release, for example) with no project reconfiguration & recompilation.

```json
{
  "cmake.generator": "Ninja Multi-Config",
  "cmake.cmakePath": "${command:cmake.buildkit.cmake.exe}",
  "cmake.preferredGenerators": ["Unix Makefiles"],
  "cmake.configureSettings": {
      "CMAKE_MAKE_PROGRAM": "${command:cmake.buildkit.generator.exe}",
      "CMAKE_VERBOSE_MAKEFILE": false
  }
}
```

**There is a problem** with this generator, though: the default virtual Linux distribution for WSL2 is [Ubuntu 20.04](https://releases.ubuntu.com/20.04/) which ships the [CMake version 3.16](https://cmake.org/cmake/help/latest/release/3.16.html) whereas the CMake's [Ninja Multi-Config](https://cmake.org/cmake/help/latest/generator/Ninja%20Multi-Config.html) generator is implemented in the [CMake version 3.17](https://cmake.org/cmake/help/latest/release/3.17.html). As a result, the above configuration will not currently work on stock WSL2's virtual Linux (but __might__ work on custom Linuxes, such as [openSUSE Leap](https://en.opensuse.org/openSUSE:WSL)).

Anyway, the switching between Ninja and Multi-Config Ninja is as simple as changing the `cmake.generator` configuration setting.

#### CMakeTools integration

In order to configure per user MSYS2-specific CMakeTools [Kits](https://github.com/microsoft/vscode-cmake-tools/blob/develop/docs/kits.md), issue the command **`Ctrl+Shift+P` |> CMake: Edit User-Local CMake Kits** and paste the configuration below

```json
[
  {
    "name": "MinGW32",
    "preferredGenerator": {"name": "MinGW Makefiles"},
    "environmentVariables": {"PATH": "${command:mingw32.path}"},
    "compilers": {
      "C": "${command:mingw32.cc.exe}",
      "CXX": "${command:mingw32.cxx.exe}",
      "Fortran": "${command:mingw32.fc.exe}"
    },
    "keep": true
  },
  {
    "name": "MinGW64",
    "preferredGenerator": {"name": "MinGW Makefiles"},
    "environmentVariables": {"PATH": "${command:mingw64.path}"},
    "compilers": {
      "C": "${command:mingw64.cc.exe}",
      "CXX": "${command:mingw64.cxx.exe}",
      "Fortran": "${command:mingw64.fc.exe}"
    },
    "keep": true
  },
  {
    "name": "UCRT64",
    "preferredGenerator": {"name": "MinGW Makefiles"},
    "environmentVariables": {"PATH": "${command:ucrt64.path}"},
    "compilers": {
      "C": "${command:ucrt64.cc.exe}",
      "CXX": "${command:ucrt64.cxx.exe}",
      "Fortran": "${command:ucrt64.fc.exe}"
    },
    "keep": true
  },
  {
    "name": "Clang32",
    "preferredGenerator": {"name": "MinGW Makefiles"},
    "environmentVariables": {"PATH": "${command:clang32.path}"},
    "compilers": {
      "C": "${command:clang32.cc.exe}",
      "CXX": "${command:clang32.cxx.exe}",
      "Fortran": "${command:clang32.fc.exe}"
    },
    "keep": true
  },
  {
    "name": "Clang64",
    "preferredGenerator": {"name": "MinGW Makefiles"},
    "environmentVariables": {"PATH": "${command:clang64.path}"},
    "compilers": {
      "C": "${command:clang64.cc.exe}",
      "CXX": "${command:clang64.cxx.exe}",
      "Fortran": "${command:clang64.fc.exe}"
    },
    "keep": true
  },
  {
    "name": "MSYS2",
    "preferredGenerator": {"name": "Unix Makefiles"},
    "environmentVariables": {"PATH": "${command:msys2.path}"},
    "compilers": {
      "C": "${command:msys2.cc.exe}",
      "CXX": "${command:msys2.cxx.exe}",
      "Fortran": "${command:msys2.fc.exe}"
    },
    "keep": true
  },
  {
    "name": "Cygwin32",
    "preferredGenerator": {"name": "Unix Makefiles"},
    "environmentVariables": {"PATH": "${command:cygwin32.path}"},
    "compilers": {
      "C": "${command:cygwin32.cc.exe}",
      "CXX": "${command:cygwin32.cxx.exe}",
      "Fortran": "${command:cygwin32.fc.exe}"
    },
    "keep": true
  },
  {
    "name": "Cygwin64",
    "preferredGenerator": {"name": "Unix Makefiles"},
    "environmentVariables": {"PATH": "${command:cygwin64.path}"},
    "compilers": {
      "C": "${command:cygwin64.cc.exe}",
      "CXX": "${command:cygwin64.cxx.exe}",
      "Fortran": "${command:cygwin64.fc.exe}"
    },
    "keep": true
  }
]
```

**Note** that the above configuration command is only available when the CMakeTools extension is active, e.g. when a CMake project is open.

#### CppTools integration

##### Launch & debug configuration

In order to configure the per project configuration in `.vscode/launch.json` file which plays nicely with the [CppTools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) debugging funcionality, issue the command **`Ctrl+Shift+P` |> Open launch.json** and paste the configuration below

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

This configuration employs the GDB debugger specific to the CMake build kit currently in effect.
Also, it sets up the PATH environment variable to include both executable directory and toolchain binary directory for launcher to reach all the required dynamic libraries.

The configuration is expected to work in both MSYS2 and Linux environments with no modifications.

#### IntelliSense configuration

In order to enable the IntelliSense support which provides the code navigation capability the following per project configuration is to be put into the `.vscode/c_cpp_properties.json` file either manually or by issuing the command **`Ctrl+Shift+P` |> C/C++: Edit Configurations (JSON)** and paste the configuration below

```json
{
    "configurations": [
        {
            "name": "Win32",
            "includePath": [
                "${workspaceFolder}/**"
            ],
            "defines": [
                "_DEBUG",
                "UNICODE",
                "_UNICODE"
            ],
            "cStandard": "c99",
            "cppStandard": "c++11",
            "intelliSenseMode": "windows-gcc-x64",
            "compileCommands": "${workspaceFolder}/build/compile_commands.json",
            "configurationProvider": "ms-vscode.cmake-tools"
        },
        {
            "name": "Linux",
            "includePath": [
                "${workspaceFolder}/**"
            ],
            "defines": [],
            "cStandard": "c99",
            "cppStandard": "c++11",
            "intelliSenseMode": "linux-gcc-x64",
            "compileCommands": "${workspaceFolder}/build/compile_commands.json",
            "configurationProvider": "ms-vscode.cmake-tools"
        }
    ],
    "version": 4
}
```

This configuration is set up to work with the CMakeTools extension which provides the toolchain in effect. 

The  `includePath`, `defines`, `*Standard`, `intelliSenseMode` properties are likely to be tailoerd to meet the specific needs, though the default values can be used as a starting point.

## Troubleshooting

The MSYS2 is a very simple extension which should work well out of the box and 90% of the problems can be resolved by making two simple steps:

1. Reload the VS Code window with **`Ctrl+Shift+P` |> Developer: Reload Window**

2. Reconfigure the CMake project with with **`Ctrl+Shift+P` |> CMake: Delete Cache and Reconfigure**

## Known issues & caveats

[0.1.0] The integrated terminal `terminal.integrated.shell.windows` setting so far does not actually perform command substitution effectively precluding the use of the package-provided `msys2.bash.exe` command to obtain the actual path to Bash executable.

[0.2.0] When switching between the CMakeTools build kits within a single work session, the CMake `cmake.cmakePath` property is not re-evaluated even in spite of the requested command interpolation (`${command:cmake.buildkit.cmake.exe}`, for example). As a result, a previous kit's value will be reused. In order to synchronize its value, a session restart is required. On the contrary, a generator tool specified by the `cmake.configureSettings` property gets updated correctly.
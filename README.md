# MSYS2 support extension for Visual Studio Code 

This extension brings in configuration and employment of the [MSYS2](https://www.msys2.org/) & [MinGW](http://mingw-w64.org) toolchains to [Visual Studio Code](https://code.visualstudio.com/).

## Features

- [CMakeTools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cmake-tools) integration

## Requirements

- 64-bit Windows 7+

- 64-bit MSYS2 installation

- 32/64-bit MinGW installations

## Setup & Configuration

This extension is primarily designed to work with the CMakeTools extension.

The following steps are to be performed in order to configure a minimal useble MSYS2, MinGW and Visual Studio Code environments.

### MSYS2 & MinGW installation

### Per user Visual Studio Code required extensions

### Per user Visual Studio Code configuration

The basic per user extension configuration is performed by issuing the keyboard shortcut **`Ctrl+,`** and pasting the below configuration to the `settings.json` configuration file.

**Note** that in case of existing configuration the above JSON configuration should not be pasted verbatim. Instead, the keys inside the outer {} braces should be appended to configuration.


#### MSYS2 & MinGW configuration

The MSYS2 location is specified by the `msys2.root` configuration option in  the `settings.json` configuration file. It can be modified either from the VisualStudio Code UI configurator accessed with the keyboard shortcut **`Ctrl+,`** or by editing the `settings.json` file directly. By default the `msys2.root` is set to `c:\msys64` which is the default location proposed by the MSYS2 installer.

The 32/64-bit MinGW locations are specified by the respective `mingw32.root` and `mingw64.root` configuration options. If not set, their values will be computed according to the `msys2.root` value, hence there is no need to coupe with them in order to use the MSYS2-provided MinGW installation.

#### CMake & generator configuration

```json
{
  "cmake.cmakePath": "${command:msys2.cmake.exe}",
  "cmake.generator": "Ninja Multi-Config",
  "cmake.configureSettings": {
      "CMAKE_MAKE_PROGRAM": "${command:msys2.ninja.exe}",
      "CMAKE_VERBOSE_MAKEFILE": true
  }
}
```

The above configuration employs the MSYS2 build of CMake and [Ninja](https://ninja-build.org/) as the generator tool instead of a more common [GNU Make](https://www.gnu.org/software/make/). The reason is that MSYS2-specific builds of the tools make it possible to use MSYS2, MinGW32 and MinGW64 kits without altering the configuration.

It is possible to use GNU Make but it requires to use the specific MinGW versions of CMake and GNU Make tools thus making the respective changes to the configuration defeating the _MinGW-neutrality_ feature of the setup.

```json
{
  "cmake.cmakePath": "${command:mingw64.cmake.exe}",
  "cmake.generator": "MinGW Makefiles",
  "cmake.configureSettings": {
      "CMAKE_MAKE_PROGRAM": "${command:mingw64.make.exe}",
      "CMAKE_VERBOSE_MAKEFILE": true
  }
}
```

On the bright side, the above MinGW configuration _should_ work with standalone MinGW installation as it does not require the availability of MSYS2. `mingw64` is to be replaced with `mingw32` for 32-bit MinGW.

The `CMAKE_VERBOSE_MAKEFILE` parameter is optional and defaults to **false** when omitted. When set to **true** the generated makefiles output the command lines being executed.

#### CMakeTools integration

In order to configure per user MSYS2-specific CMakeTools [Kits](https://github.com/microsoft/vscode-cmake-tools/blob/develop/docs/kits.md), issue the command **`F1`|> CMake: Edit User-Local CMake Kits** and paste the configuration below

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
    "environmentVariables": {"PATH": "${command:msys2.usr.bin}"},
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

## Known Issues

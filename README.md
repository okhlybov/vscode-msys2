# MSYS2 support extension for Visual Studio Code 

This extension brings in configuration and employment of the [MSYS2](https://www.msys2.org/) toolchains to the Visual Studio Code.

## Features

-[CMakeTools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cmake-tools) integration

## Requirements

- 64-bit MSYS2 installation

## Setup & Configuration

This extension is primarily designed to work with the CMakeTools extension.

### Per user Visual Studio Code configuration

The basic per user extension configuration is performed by issuing the command **`Ctrl+,`** and adding the below configuration to the `settings.json`

```json
{
  "cmake.cmakePath": "${command:msys2.cmake.exe}",
  "cmake.generator": "Ninja Multi-Config",
  "cmake.configureSettings": {
      "CMAKE_MAKE_PROGRAM": "${command:msys2.ninja.exe}",
      "CMAKE_VERBOSE_MAKEFILE": true
  },
}
```

**Note** that in case of existing configuration the above JSON code should not be pasted verbatim. Instead, the keys inside the outer {} braces should be appended to configuration.

The presented configuration employs the MSYS2 version of CMake and [Ninja](https://ninja-build.org/) as the generator tool instead of more common [GNU Make](https://www.gnu.org/software/make/). The reason is that MSYS2 versions of the tools make it possible to use MSYS2, MinGW32 and MinGW64 kits without changing the configuration.

### CMakeTools integration

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

**Note** that the above configuration command is only visible when the CMakeTools extension is actvie, e.g. when a CMake project is open.

## Known Issues

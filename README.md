# MSYS2 support extension for Visual Studio Code 

## Features

## Requirements

## Extension Settings

### CMake integration

This extension is primarily designed to work with the [CMakeTools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cmake-tools) extension.

In order to configure per user MSYS2 CMakeTools Kits, issue the command **`F1`|> CMake: Edit user-local CMake kits** and paste the below configuration

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

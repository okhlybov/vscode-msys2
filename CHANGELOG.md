# Change Log

## [0.11.0] 2026-10-26

- VS Code required version bump to 1.74.0

- Code deduplication: table-driven toolchain registry

- Fixed launch PATH degradation without a recognized build kit

- Unrecognized CMake generator and MinGW provider fall back to sane defaults

- Cygwin build kits no longer fail on MPI tools

- CMake Kits injection & removal commands for the user-local and per-project configurations

- CMake Presets injection & removal commands for the per-user and shared project descriptors

- Extension management dashboard

- Regression test suite

- The build kit commands degrade gracefully when the CMakeTools extension is not installed

- Non-array CMake Kits descriptors are reported as unparsable instead of failing obscurely

- Documentation fixes

## [0.10.1] 2026-10-03

- Bug fixes

## [0.10.0] 2023-03-08

- MPI support

- Documentation update

- Fix clobbering package-handled CMake Kits for MinGW* by the CMakeTools scanner (_existing CMake Kits JSON configuration fix is required_)

- Rudimentary Meson support

## [0.9.1] 2021-11-15

- Documentation update

- Extension availability on OpenVSX

## [0.9.0] 2021-6-17

- MSYS2's Clang support

- CMakeTools' build kit settings template update

- Documentation update

## [0.8.0] 2021-4-25

- UCRT-based MinGW support

- CMakeTools' build kit settings template update

## [0.7.0] 2021-3-16

- Proper handling of the build kit -specific configure time PATH environment variable

- CMakeTools' build kit settings template update

- Documentation update

## [0.6.0] 2021-3-9

- Add MinGW provider selector

- Documentation update

## [0.5.0] 2021-3-2

- Makefile generator settings unification

- CMakeTools' build kit settings template update

- VS Code's per user settings template update

- Documentation update

## [0.4.0] 2021-2-18

- Cygwin support

- CMakeTools' build kit settings template update

## [0.3.1] 2021-2-13

- Force all emitted paths to use forward slashes

## [0.3.0] 2021-2-8

- Introduce CppTools support via `launch.json`

- Introduce CMakeTools' build kit -specific `bin` directory command and PATH command for use within `launch.json`

- VS Code's per user settings template update

- Documentation update

## [0.2.0] 2021-2-6

- Introduce a few CMakeTools' build kit -specific commands `cmake.buildkit.*.exe` to enable the use of build kit -specific CMake & generator tools instead of the generic MSYS2-specific ones.

- VS Code's per user settings template update

- Documentation update

## [0.1.0] 2021-1-30

- Initial release
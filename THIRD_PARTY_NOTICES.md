# Third-party notices

## Installed dependencies (npm)

Mineflayer, mineflayer-pathfinder, mineflayer-collectblock, mineflayer-tool,
minecraft-data, prismarine-* (PrismarineJS, MIT) and the Model Context Protocol
SDK (MIT) are used as regular npm dependencies under their own licenses.

For native Minecraft 26.3, `mineflayer` is pinned to
[hammermaps/Mineflayer](https://github.com/hammermaps/Mineflayer), an MIT-licensed
fork of PrismarineJS Mineflayer. Its native data installer patches this repo's
installed `minecraft-data`, `prismarine-chunk`, and `prismarine-physics` packages.
The 26.3 digging action mapping in `runtime/bot/connect.js` follows
[PrismarineJS/mineflayer#4146](https://github.com/PrismarineJS/mineflayer/pull/4146)
by DallasCarraher (MIT).

## mindcraft — MIT License

Portions of `runtime/tools/gather.js`, `craft.js`, `smelt.js`, `place.js`,
`inventory.js` and `world.js` are adapted from
https://github.com/mindcraft-bots/mindcraft (`src/agent/library/skills.js`,
`src/agent/library/world.js`).

```
MIT License

Copyright (c) 2024 Kolby Nottingham

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Voyager — MIT License

`knowledge/seeds/voyager-imported/` is generated from the learned skill library
of https://github.com/MineDojo/Voyager (`skill_library/trial1`). The code it
contains is reference material: it calls Voyager's own primitives and is not run
as-is; agents adapt ideas from it into their own programs. Full license:
`knowledge/seeds/voyager-imported/LICENSE-VOYAGER` (Copyright (c) 2023 MineDojo Team).

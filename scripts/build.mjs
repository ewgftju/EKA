import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = join(root, 'dist')
await rm(output, { recursive: true, force: true })
await mkdir(output)
for (const entry of ['index.html', 'app.css', 'assets', 'src', 'workflow']) {
  await cp(join(root, entry), join(output, entry), { recursive: true })
}

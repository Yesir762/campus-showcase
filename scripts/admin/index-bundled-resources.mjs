import {readdir,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
const root=new URL('../../public/',import.meta.url);const {fileURLToPath}=await import('node:url');const directory=fileURLToPath(root),paths=[];
async function visit(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await visit(path);else if(item.isFile())paths.push('/'+relative(directory,path).split('\\').join('/'));}}await visit(directory);await writeFile(new URL('../../config/resource-index.json',import.meta.url),JSON.stringify(paths.sort(),null,2)+'\n');

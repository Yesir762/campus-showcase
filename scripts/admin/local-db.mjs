import {mkdir,writeFile} from 'node:fs/promises';import {spawn} from 'node:child_process';
await mkdir('.sites-runtime',{recursive:true});
await writeFile('.sites-runtime/admin-wrangler.json',JSON.stringify({name:'campus-admin-local',compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:'../drizzle'}]}));
const child=spawn(process.execPath,['--import','./scripts/sites-env.mjs','node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config','.sites-runtime/admin-wrangler.json','--persist-to','.wrangler/state'],{stdio:'inherit'});child.on('exit',code=>process.exit(code??1));

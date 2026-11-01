import {spawn} from 'node:child_process';
const children=['@philoshelf/api','@philoshelf/client','@philoshelf/admin'].map(w=>spawn('npm',['run','dev','-w',w],{stdio:'inherit',env:process.env}));
function stop(){for(const c of children)c.kill();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
for(const c of children)c.on('exit',code=>{stop();process.exit(code??0)});

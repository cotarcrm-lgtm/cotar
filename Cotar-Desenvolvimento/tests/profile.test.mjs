import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {profileIdentity} from '../server/profile.js';
import {displayName,avatarContent} from '../public/user-display.js';
const photo='data:image/jpeg;base64,'+fs.readFileSync('tests/fixtures/avatar.jpg').toString('base64');
test('apelido, foto, remoção e validação do perfil',()=>{
 assert.deepEqual(profileIdentity({nickname:'  Carlos  ',photo},{}),{nickname:'Carlos',photo});
 assert.deepEqual(profileIdentity({}, {nickname:'Carlos',photo}),{nickname:'Carlos',photo});
 assert.deepEqual(profileIdentity({nickname:'',photo:''},{nickname:'Carlos',photo}),{nickname:'',photo:''});
 for(const bad of ['https://example.test/photo.jpg','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,AAAA',photo+'!','x'.repeat(65001)])assert.throws(()=>profileIdentity({photo:bad},{}));
 assert.throws(()=>profileIdentity({nickname:'x'.repeat(41)},{}));
 assert.throws(()=>profileIdentity({nickname:'Carlos\nAdmin'},{}));
 assert.equal(displayName({name:'Carlos Silva Santos',nickname:'Carlão'}),'Carlão');assert.equal(displayName({name:'Carlos Silva Santos'}),'Carlos');
 assert(avatarContent({name:'Carlos',photo}).includes('<img'));assert(!avatarContent({name:'Carlos',photo:'javascript:alert(1)'}).includes('<img'));
});

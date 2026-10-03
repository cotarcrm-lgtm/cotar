import {randomUUID} from 'node:crypto';
const passwords=new Map();
export function testPassword(id){if(!passwords.has(id))passwords.set(id,randomUUID()+'aA1!');return passwords.get(id);}

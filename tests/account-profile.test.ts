import {expect,it} from 'vitest';
import {accountName,accountPhoto} from '../src/account-profile';
const provider={photoURL:'https://example.test/google.png',providerData:[{providerId:'google.com',photoURL:'https://example.test/google.png'}]} as any;
it('uses only the Journas name and derives a changed initial from it',()=>{expect(accountName('  Alice  ')).toBe('Alice');expect(Array.from(accountName('Bob'))[0]).toBe('B');expect(accountName(undefined)).toBe('Account');});
it('uses initials for password sign-in rather than inheriting the Google profile photo',()=>expect(accountPhoto(provider,false)).toBeUndefined());
it('keeps manually uploaded photos for both password and Google sign-in',()=>{const photo='data:image/png;base64,custom';expect(accountPhoto(provider,false,photo)).toBe(photo);expect(accountPhoto(provider,true,photo)).toBe(photo);});
it('allows the Google photo only as a Google sign-in default',()=>expect(accountPhoto(provider,true)).toBe(provider.photoURL));

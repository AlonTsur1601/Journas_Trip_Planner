import {it,expect} from 'vitest';
import {userErrorMessage} from '../src/user-error';
it('explains an existing email account and gives a recovery path',()=>{const text=userErrorMessage({code:'auth/email-already-in-use',message:'Firebase: Error (auth/email-already-in-use).'});expect(text).toContain('already exists');expect(text).toContain('Sign in');expect(text).toContain('reset your password');expect(text).not.toMatch(/Firebase|auth\//);});
it('also cleans provider messages passed to a toast as strings',()=>{expect(userErrorMessage('Firebase: Error (auth/invalid-credential).')).toContain('email address or password');});
it('does not reveal whether a failed sign-in belongs to an existing account',()=>{expect(userErrorMessage({code:'auth/user-not-found'})).toBe(userErrorMessage({code:'auth/invalid-credential'}));});
it('keeps useful application messages and success notices',()=>{for(const message of ['Changes saved.','This account name is already taken. Choose another name.'])expect(userErrorMessage(message)).toBe(message);});
it('replaces unknown provider diagnostics and browser network errors',()=>{expect(userErrorMessage('Firebase: Error (auth/internal-error).')).not.toMatch(/Firebase|auth\//);expect(userErrorMessage(new TypeError('Failed to fetch'))).toContain('internet connection');});

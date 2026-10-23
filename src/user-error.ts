const messages:Record<string,string>={
 'auth/email-already-in-use':'An account with this email address already exists. Sign in instead, or reset your password.',
 'auth/invalid-email':'Enter a valid email address.',
 'auth/invalid-credential':'The email address or password is incorrect. Check both and try again.',
 'auth/wrong-password':'The password is incorrect. Try again, or reset your password.',
 'auth/user-not-found':'The email address or password is incorrect. Check both and try again.',
 'auth/weak-password':'Choose a stronger password with at least 6 characters.',
 'auth/password-does-not-meet-requirements':'Choose a stronger password that meets the requirements shown.',
 'auth/too-many-requests':'Too many attempts. Please wait a few minutes and try again.',
 'auth/network-request-failed':'We couldn’t connect. Check your internet connection and try again.',
 'auth/popup-closed-by-user':'The sign-in window was closed. Try again when you’re ready.',
 'auth/cancelled-popup-request':'Another sign-in window is already open. Continue there, or try again.',
 'auth/popup-blocked':'Your browser blocked the sign-in window. Allow pop-ups for Journas and try again.',
 'auth/account-exists-with-different-credential':'This email address already has an account. Sign in using the method you used before, then link the new sign-in method in Settings.',
 'auth/credential-already-in-use':'This sign-in method is linked to another account. Sign in to that account instead.',
 'auth/requires-recent-login':'For your security, sign in again before making this change.',
 'auth/user-disabled':'This account has been disabled. Contact support for help.',
 'auth/expired-action-code':'This link has expired. Request a new email and use the latest link.',
 'auth/invalid-action-code':'This link is no longer valid. Request a new email and use the latest link.',
 'auth/operation-not-allowed':'This sign-in method is currently unavailable. Try another method.',
};
/** Translate provider diagnostics at the UI boundary; retain readable application messages. */
export function userErrorMessage(error:unknown,fallback='We couldn’t complete that request. Please try again.'){
 const value=error as {code?:string;message?:string}|null;
 const message=typeof error==='string'?error:typeof value?.message==='string'?value.message:'';
 const code=value?.code??message.match(/auth\/[a-z-]+/)?.[0];
 if(code&&messages[code])return messages[code];
 if(/failed to fetch|networkerror|load failed/i.test(message))return messages['auth/network-request-failed'];
 if(!message||code?.startsWith('auth/')||/^Firebase[: ]|^Error:|^INTERNAL|^UNKNOWN_ERROR/i.test(message))return fallback;
 return message;
}

import {useEffect,useState} from 'react';
import {Compass,Check,AlertCircle} from 'lucide-react';
import {signInWithCustomToken} from 'firebase/auth';
import {auth} from './firebase';
import {createEmailVerification,verificationFailure} from './email-verification-action';
import {returnAfterVerification} from './email-verification-return';

const parameters=new URLSearchParams(window.location.search);
const code=parameters.get('oobCode');
const returnClientId=parameters.get('returnClientId');
const verify=createEmailVerification(auth,code);
export default function EmailVerificationAction(){
  const [message,setMessage]=useState('Verifying your email…');
  const [phase,setPhase]=useState<'verifying'|'opening'|'complete'|'error'>('verifying');
  const [attempt,setAttempt]=useState(0);
  const [retryable,setRetryable]=useState(false);
  useEffect(()=>{
    let active=true;
    setPhase('verifying');
    setMessage('Verifying your email…');
    let verified=false;
    void verify().then(async email=>{
      verified=true;
      if(!active)return;
      // Remove the one-time credential only after it has been accepted.
      history.replaceState(null,'','/verify-email');
      setPhase('opening');
      setMessage('Your email is verified. Getting Journas ready for you…');
      const result=await returnAfterVerification(returnClientId,email).catch(()=>({focused:false,sameBrowser:false,sessionToken:undefined}));
      if(!active)return;
      if(result.sameBrowser&&!result.focused){
        if(!auth||!result.sessionToken){
          setPhase('complete');
          setMessage('Email verified. Continue in your original Journas tab, where you are already signed in.');
          return;
        }
        try{await signInWithCustomToken(auth,result.sessionToken);}
        catch{if(active){setPhase('complete');setMessage('Email verified. Continue in your original Journas tab, where you are already signed in.');}return;}
        if(!active)return;
        // The email already opened this tab; reuse it instead of a blocked popup.
        window.location.replace('/');
        return;
      }
      setMessage('Email verified. You can close this tab. Your original Journas session will update automatically.');
      setPhase('complete');
      window.close();
    }).catch(error=>{if(!active)return;if(verified){setPhase('complete');setMessage('Email verified. Return to Journas to continue.');return;}const failure=verificationFailure(error);setRetryable(failure.retryable);setPhase('error');setMessage(failure.message);});
    return()=>{active=false;};
  },[attempt]);
  const busy=phase==='verifying'||phase==='opening';
  return <main className="home-page email-verification-screen verification-action-screen">
    <div className="auth-map-background" aria-hidden="true"/>
    <section className="verification-action-card" aria-labelledby="verification-title" aria-busy={busy}>
      <div className="verification-action-brand"><Compass size={22}/><strong>Journas</strong></div>
      <div className={`verification-action-symbol${busy?' is-loading':''}`} aria-hidden="true">{phase==='error'?<AlertCircle/>:phase==='complete'?<Check/>:<Compass/>}</div>
      <h1 id="verification-title">{phase==='verifying'?'One moment, you’re almost there.':phase==='opening'?'Welcome to Journas.':phase==='complete'?'You’re all set.':'Let’s try that again.'}</h1>
      <p className="verification-action-message" role="status" aria-live="polite">{message}</p>
      {phase==='error'&&retryable&&<button className="button primary" onClick={()=>setAttempt(value=>value+1)}>Try again</button>}
    </section>
  </main>;
}

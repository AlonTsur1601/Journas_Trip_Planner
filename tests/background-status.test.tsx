import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import LoadingScreen,{BackgroundStatus,finishStartup} from '../src/LoadingScreen';
it('uses the full screen only for the initial authentication gate',()=>{
 const startup=renderToStaticMarkup(<LoadingScreen startup/>);expect(startup).toContain('activity-screen');expect(startup).toContain('Journas');expect(startup).toContain('brand home-brand startup-brand');expect(startup).toContain('home-page activity-screen');expect(startup).toContain('auth-map-background');
 const visibleWorkspace=renderToStaticMarkup(<LoadingScreen/>);expect(visibleWorkspace).toContain('background-status');expect(visibleWorkspace).not.toContain('activity-screen');
 finishStartup();const html=renderToStaticMarkup(<LoadingScreen startup text="Loading another account"/>);
 expect(html).toContain('background-status');expect(html).not.toContain('activity-screen');expect(html).not.toContain('tabindex');expect(html).not.toContain('inert');
});
it('announces background progress without adding a focus target or modal',()=>{
 const html=renderToStaticMarkup(<BackgroundStatus text="Saving a task"/>);expect(html).toContain('role="status"');expect(html).toContain('class="loading-spinner"');expect(html).not.toContain('progressbar');expect(html).not.toContain('dialog');expect(html).not.toContain('tabindex');
});

import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import LoadingScreen,{BackgroundStatus,finishStartup} from '../src/LoadingScreen';
it('never restores the old loading screen, including initial startup',()=>{
 const startup=renderToStaticMarkup(<LoadingScreen/>);expect(startup).toContain('background-status');expect(startup).not.toContain('activity-screen');
 finishStartup();const html=renderToStaticMarkup(<LoadingScreen text="Loading another account"/>);
 expect(html).toContain('background-status');expect(html).not.toContain('activity-screen');expect(html).not.toContain('tabindex');expect(html).not.toContain('inert');
});
it('announces background progress without adding a focus target or modal',()=>{
 const html=renderToStaticMarkup(<BackgroundStatus text="Saving a task"/>);expect(html).toContain('role="status"');expect(html).not.toContain('dialog');expect(html).not.toContain('tabindex');
});

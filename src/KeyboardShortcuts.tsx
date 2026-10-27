const groups=[
 ['Planning',[
  ['Ctrl + S','Save planning'],['Ctrl + Z','Undo the last planning change'],['Ctrl + Shift + Z','Redo a planning change'],
 ]],
 ['Schedule',[
  ['Ctrl + +','Increase the spacing between hour lines'],['Ctrl + −','Decrease the spacing between hour lines'],['Ctrl + mouse wheel','Zoom the schedule around the pointer'],
 ]],
 ['Map (when the map has keyboard focus)',[
  ['Arrow keys','Pan the map'],['+ / −','Zoom the map in or out'],['Shift + + / Shift + −','Zoom the map by two levels'],['Shift + ← / →','Rotate the map'],['Shift + ↑ / ↓','Tilt the map'],
 ]],
 ['Menus and forms',[
  ['Tab / Shift + Tab','Move to the next or previous control'],['Enter / Space','Activate a focused button or option'],['Esc','Close a menu, picker or dialog (except during the guided tour)'],['↑ / ↓','Move between dropdown options or location suggestions'],['Home / End','First or last dropdown option'],['Enter','Select a location suggestion'],['← / →','Move between the parts of a date or time field'],
 ]],
 ['Time wheels',[
  ['↑ / ↓','Previous or next hour or minute'],['Page Up / Page Down','Move by five hours or minutes'],['Home / End','First or last value'],
 ]],
 ['Workspace and colors',[
  ['Arrow keys','Resize the focused map/schedule divider'],['Arrow keys','Adjust the focused color plane or slider'],['Shift + Arrow keys','Larger adjustments in the color plane'],
 ]],
] as const;
export default function KeyboardShortcuts(){
 return <div className="keyboard-shortcuts"><p>Schedule zoom applies while the pointer is over the schedule or a control inside it has focus. The spacing is saved for that day.</p><p>On Mac, Cmd also works for Save, Undo and Redo. Undo and Redo leave text-field editing to the browser.</p>{groups.map(([name,rows])=><section key={name}><h3>{name}</h3><dl>{rows.map(([keys,action])=><div key={keys+action}><dt><kbd>{keys}</kbd></dt><dd>{action}</dd></div>)}</dl></section>)}</div>;
}

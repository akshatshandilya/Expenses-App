// Test-only entry: boots the real app code and exposes a few handles so the parity test can load the same demo data the preview uses.
import {S,blank,replaceState} from '../../src/data/state.js';
import {setStack,draw} from '../../src/ui/nav.js';
import {seedDemo} from '../fixtures/seed-demo.js';
import '../../src/main.js';
window.__t={S,blank,replaceState,setStack,draw,seedDemo};
import {showLock,unlock,isLocked,onAppState} from '../../src/native/lock.js';
import {A} from '../../src/ui/registry.js';
Object.assign(window.__t,{showLock,unlock,isLocked,onAppState,A});
import {platform} from '../../src/native/platform.js';
window.__t.platform=platform;

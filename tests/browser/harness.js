// Test-only entry: boots the real app code and exposes a few handles so the parity test can load the same demo data the preview uses.
import {S,blank,replaceState,persist} from '../../src/data/state.js';
import {setStack,draw} from '../../src/ui/nav.js';
import {seedDemo} from '../fixtures/seed-demo.js';
import '../../src/main.js';
window.__t={S,blank,replaceState,persist,setStack,draw,seedDemo};
import {showLock,unlock,isLocked,onAppState} from '../../src/native/lock.js';
import {A} from '../../src/ui/registry.js';
Object.assign(window.__t,{showLock,unlock,isLocked,onAppState,A});
import {platform} from '../../src/native/platform.js';
window.__t.platform=platform;

import * as SYNCSVC from '../../src/sync/service.js';
import * as ENGINE from '../../src/sync/engine.js';
import {makeMemServer} from '../helpers/memserver.mjs';
window.__t.sync=SYNCSVC;window.__t.E=ENGINE;window.__t.makeMem=makeMemServer;

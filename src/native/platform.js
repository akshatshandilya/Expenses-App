/* Everything that touches Android lives behind this object, so the rest of the app never imports a plugin.
   In a plain browser (used only by the automated tests) each call falls back to a harmless in-memory version. */
import {Capacitor,SystemBars,SystemBarsStyle} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {SecureStorage} from '@aparajita/capacitor-secure-storage';
import {BiometricAuth} from '@aparajita/capacitor-biometric-auth';
import {PrivacyScreen} from '@capacitor-community/privacy-screen';

export const isNative=Capacitor.isNativePlatform();
export const mem={secrets:new Map(),files:new Map()};
export const EXPORT_DIR='exports';

export const platform={
  isNative,
  /* ---- small secrets (the data key) in the Android Keystore ---- */
  async getSecret(name){
    if(!isNative)return mem.secrets.has(name)?mem.secrets.get(name):null;
    await SecureStorage.setKeyPrefix('expenses_');
    const v=await SecureStorage.get(name,false);return typeof v==='string'?v:null;
  },
  async setSecret(name,value){
    if(!isNative){mem.secrets.set(name,value);return;}
    await SecureStorage.setKeyPrefix('expenses_');
    await SecureStorage.set(name,value,false);
  },
  /* ---- private app files (encrypted data slots), base64 text in and out ---- */
  async readFile(name){
    if(!isNative)return mem.files.has(name)?mem.files.get(name):null;
    try{const r=await Filesystem.readFile({path:name,directory:Directory.Data});return typeof r.data==='string'?r.data:null;}
    catch(e){return null;}
  },
  async writeFile(name,b64){
    if(!isNative){mem.files.set(name,b64);return;}
    await Filesystem.writeFile({path:name,data:b64,directory:Directory.Data});
  },
  /* ---- temporary export files, handed to the Android share sheet and then deleted ---- */
  async shareTempFile(name,text,title){
    if(!isNative){mem.files.set('share:'+name,text);return true;}
    const path=EXPORT_DIR+'/'+name;
    try{
      await Filesystem.writeFile({path,data:text,directory:Directory.Cache,encoding:Encoding.UTF8,recursive:true});
      const u=await Filesystem.getUri({path,directory:Directory.Cache});
      await Share.share({title:title,dialogTitle:title,files:[u.uri]});
      return true;
    }catch(e){
      const m=String((e&&e.message)||'');if(/cancel/i.test(m))return false;throw e;
    }finally{try{await Filesystem.deleteFile({path,directory:Directory.Cache});}catch(x){}}
  },
  async cleanTemp(){
    if(!isNative)return;
    try{await Filesystem.rmdir({path:EXPORT_DIR,directory:Directory.Cache,recursive:true});}catch(e){}
  },
  /* ---- screen lock ---- */
  async deviceSecure(){
    if(!isNative)return true;
    try{const r=await BiometricAuth.checkBiometry();return !!(r.isAvailable||r.deviceIsSecure);}catch(e){return false;}
  },
  /* 'ok' | 'cancel' | 'unavailable' | 'fail' */
  async authenticate(reason){
    if(!isNative)return 'ok';
    try{
      await BiometricAuth.authenticate({reason:reason,cancelTitle:'Cancel',allowDeviceCredential:true,androidTitle:'Expenses',androidSubtitle:reason});
      return 'ok';
    }catch(e){
      const c=String((e&&e.code)||'');
      if(/cancel/i.test(c))return 'cancel';
      if(/NotAvailable|NotEnrolled|noDeviceCredential/i.test(c))return 'unavailable';
      return 'fail';
    }
  },
  async setPrivacy(on){
    if(!isNative)return;
    try{if(on)await PrivacyScreen.enable();else await PrivacyScreen.disable();}catch(e){}
  },
  async setBars(dark){
    if(!isNative)return;
    try{await SystemBars.setStyle({style:dark?SystemBarsStyle.Dark:SystemBarsStyle.Light});}catch(e){}
  },
  /* ---- app lifecycle ---- */
  onAppState(cb){if(isNative)App.addListener('appStateChange',s=>cb(!!s.isActive));},
  onBack(cb){if(isNative)App.addListener('backButton',cb);},
  minimize(){if(isNative){try{App.minimizeApp();}catch(e){App.exitApp();}}}
};

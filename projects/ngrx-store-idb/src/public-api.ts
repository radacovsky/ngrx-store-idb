/*
 * Public API Surface of ngrx-store-idb
 */
import * as RehydrateActions from './lib/ngrx-store-idb.actions';

export * from './lib/ngrx-store-idb.module';
export {
  KeyConfiguration,
  Keys,
  NgrxStoreIdbOptions
} from './lib/ngrx-store-idb.options';
export { RehydrateActions };

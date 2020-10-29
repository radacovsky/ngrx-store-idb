/*
 * Public API Surface of ngrx-store-idb
 */
import * as RehydrateActions from './lib/rehydrate.actions';

export * from './lib/ngrx-store-idb.module';
export {
  KeyConfiguration,
  Keys,
  NgrxStoreIdbOptions
} from './lib/ngrx-store-idb.options';
export { RehydrateActions };

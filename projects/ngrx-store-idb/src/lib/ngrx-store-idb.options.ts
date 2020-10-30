import { InjectionToken } from '@angular/core';
import { TypedAction } from '@ngrx/store/src/models';
import { Store } from 'idb-keyval';

/**
 * Injection token for injection options
 */
export const OPTIONS = new InjectionToken<NgrxStoreIdbOptions>('NgrxStoreIdb options');

/**
 * Injection token for injecting IDB store
 */
export const IDB_STORE = new InjectionToken<Store>('IDB Store');

/**
 * Name of the key in IndexedDB database store under which the state will be saved
 */
export const SAVED_STATE_KEY = 'State';

export interface KeyConfiguration {
  [key: string]: string[] | number[] | KeyConfiguration[];
}

export type Keys = (KeyConfiguration | string)[];

/**
 * Configuration options for NgrxStoreIdb
 */
export interface NgrxStoreIdbOptions {
  /**
   * IndexDB configuration
   */
  idb: {
    /**
     * Database name
     */
    dbName: string;
    /**
     * Store name
     */
    storeName: string;
  };
  /**
   * If true then store will be restored from IndexedDB on application startup
   */
  rehydrate: boolean;
  /**
   * Save state into IndexedDB only if the state to be save changed since last save.
   */
  saveOnChange: boolean;
  /**
   * Defines what slices of store should be stored/rehydrated.
   * Can not be defined if marshaller & unmarshaller are defined.
   * Default is null.
   */
  keys: Keys;
  /**
   * If defined then synchronisation of store -> IDB will be done only when the function returns true.
   * You can use it e.g. to do syncing only on certain action.
   */
  syncCondition: ((state: any, action: TypedAction<any>) => boolean) | null;
  /**
   * Method used to merge data loaded from IDB with Store state during rehydratation.
   * When null then default will be full deep merge. Must be used together with marshaller.
   * Can not be used together with keys.
   */
  unmarshaller: (state: any, rehydratedState: any) => any;
  /**
   * Method used to marshall store state into object to be written into IDB.
   * Must be used together with unmarshaller.
   * Can not be used together with keys.
   */
  marshaller: (state: any) => any;
  /**
   * Print debug info if true
   */
  debugInfo: boolean;
}


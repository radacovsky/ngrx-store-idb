import { ActionReducer, INIT, UPDATE } from '@ngrx/store';
import * as deepmerge from 'deepmerge';
import { set, Store } from 'idb-keyval';
import { rehydrateAction, RehydrateActionPayload, rehydrateErrorAction, rehydrateInitAction } from './ngrx-store-idb.actions';
import { KeyConfiguration, Keys, NgrxStoreIdbOptions, SAVED_STATE_KEY } from './ngrx-store-idb.options';
import { NgrxStoreIdbService } from './ngrx-store-idb.service';

/**
 * Default marshaller saves the whole store state
 */
export const defaultMarshaller = (state: any) => state;

// Default merge strategy is a full deep merge.
export const defaultUnmarshaller = (state: any, rehydratedState: any) => {
  const overwriteMerge = (destinationArray: any, sourceArray: any, options: any) => sourceArray;
  const options: deepmerge.Options = {
      arrayMerge: overwriteMerge,
  };

  return deepmerge(state, rehydratedState, options);
};

export const DEFAULT_OPTS: NgrxStoreIdbOptions = {
  rehydrate: true,
  saveOnChange: true,
  syncCondition: null,
  keys: null,
  unmarshaller: defaultUnmarshaller,
  marshaller: defaultMarshaller,
  debugInfo: true,
  idb: {
    dbName: 'NgrxStoreIdb',
    storeName: 'Store',
  },
  concurrency: {
    allowed: false,
    refreshRate: 5000,
    trackKey: 'ConcurrencyTimestamp',
    failInitialisationIfNoLock: false,
  },
};


// Recursively traverse all properties of the existing slice as defined by the `filter` argument,
// and output the new object with extraneous properties removed.
const createStateSlice = (existingSlice: any, keys: (string | number | KeyConfiguration)[]) => {
  return keys.reduce(
      (memo: { [x: string]: any; [x: number]: any }, attr: string | number | KeyConfiguration) => {
          if (typeof attr === 'string' || typeof attr === 'number') {
              const value = existingSlice?.[attr];
              if (value !== undefined) {
                  memo[attr] = value;
              }
          } else {
              for (const key in attr) {
                  if (Object.prototype.hasOwnProperty.call(attr, key)) {
                      const element = attr[key];
                      memo[key] = createStateSlice(existingSlice[key], element);
                  }
              }
          }
          return memo;
      },
      {},
  );
};

/**
 * Marshalls actual state using keys
 */
const keysMarshaller = (state: any, keys: Keys) => {
  if (!state) {
    return state;
  }

  const res = {};
  keys.forEach(key => {
    let name = key as string;
    // If key was a string then stateSlice has value and we are done
    let stateSlice = state[name];

    // If key was a nested structure then we need to dig deeper
    if (typeof key === 'object') {
      // keys configuration always has only 1 attribute and the rest is nested
      name = Object.keys(key)[0];
      stateSlice = state[name];
      stateSlice = createStateSlice(stateSlice, key[name]);
    }

    if (stateSlice !== undefined) {
      res[name] = stateSlice;
    }
  });

  return res;
};

let lastSavedState = null;

/**
 * Compare two objects if they are equal.
 * They are equal if both have keys with the same name
 * and the same value.
 */
const statesAreEqual = (prev: any, next: any): boolean => {
  if (prev === next) {
    return true;
  }

  if (!prev || !next) {
    return false;
  }

  if (typeof prev !== 'object' || typeof next !== 'object') {
    return false;
  }

  const prevSlices = Object.keys(prev);
  const nextSlices = Object.keys(next);
  if (prevSlices.length !== nextSlices.length) {
    return false;
  }

  for (const slice of prevSlices) {
    if (!statesAreEqual(prev[slice], next[slice])) {
      return false;
    }
  }

  return true;
};

/**
 * Method used to save actual state into IndexedDB
 */
const syncStateUpdate = (state, action, opts: NgrxStoreIdbOptions, idbStore: Store, service: NgrxStoreIdbService) => {
  if (!service.canConcurrentlySync()) {
    if (opts.debugInfo) {
      console.debug('NgrxStoreIdb: State will not be persisted. Application runs also in other tab/window.');
    }
    return;
  }

  if (opts.syncCondition) {
    try {
      if (opts.syncCondition(state, action) !== true) {
          if (opts.debugInfo) {
            console.debug('NgrxStoreIdb: State will not be persisted. syncCondition is false');
          }
          return;
      }
    } catch (e) {
      // Treat TypeError as do not sync
      if (e instanceof TypeError) {
        if (opts.debugInfo) {
          console.debug('NgrxStoreIdb: State will not be persisted. syncCondition has error', e);
        }
        return;
      }
      console.error('NgrxStoreIdb: syncCondition raised error', e);
      throw e;
    }
  }

  let marshalledState = {};

  if (opts.keys) {
    marshalledState = keysMarshaller(state, opts.keys);
  } else {
    marshalledState = opts.marshaller(state);
  }

  if (opts.saveOnChange && statesAreEqual(lastSavedState, marshalledState)) {
    if (opts.debugInfo) {
      console.debug('NgrxStoreIdb: No change in state. Will skip saving to IndexedDB.');
    }
    return;
  }

  set(SAVED_STATE_KEY, marshalledState, idbStore)
    .then(() => {
      lastSavedState = marshalledState;
      service.broadcastSyncEvent(action, true);
      if (opts.debugInfo) {
        console.debug('NgrxStoreIdb: Store state persisted to IndexedDB', marshalledState, action);
      }
    })
    .catch(err => {
      if (opts.debugInfo) {
        console.error('NgrxStoreIdb: Error storing state to IndexedDB', err, action);
      }
      service.broadcastSyncEvent(action, false);
    });
};

/**
 * This is the main factory that creates our metareducer.
 */

export const metaReducerFactoryWithOptions = (options: NgrxStoreIdbOptions, idbStore: Store, service: NgrxStoreIdbService) => {
  let rehydratedState = null;
  return (reducer: ActionReducer<any>) => (state: any, action) => {
    let nextState: any;

    if (options.debugInfo) {
      console.group('NgrxStoreIdb: metareducer', state, action);
    }

    // If we are processing rehydrateAction then save rehydrated state (for later use).
    // There is no other reducer for this action.
    if (action.type === rehydrateAction.type) {
      const payload = action as RehydrateActionPayload;
      rehydratedState = payload.rehydratedState || {};
      if (!payload.rehydratedState) {
        if (options.debugInfo) {
          console.debug('NgrxStoreIdb: Rehydrated state is empty - nothing to rehydrate.');
          console.groupEnd();
        }
        return state;
      }
    }

    // If action is rehydrateAction (i.e. initial rehydratation)
    // then merge the store state with the rehydrated state
    if (action.type === rehydrateAction.type) {
      nextState = options.unmarshaller(state, rehydratedState);
      if (options.debugInfo) {
        console.debug('NgrxStoreIdb: After rehydrating current state', nextState);
      }
    } else {
      // Run normal reducer for this action
      nextState = reducer(state, action);
    }

    // If action is UPDATE then rehydrate feature slices just created (when lazy module store loads)
    if (action.type === UPDATE && action.features && rehydratedState) {
      const rehydratedStateCopy = {};
      for (const feature of action.features) {
        if (rehydratedState[feature]) {
          rehydratedStateCopy[feature] = rehydratedState[feature];
        }
      }
      nextState = options.unmarshaller(nextState, rehydratedStateCopy);
      if (options.debugInfo) {
        console.debug('NgrxStoreIdb: After rehydrating current state', nextState);
      }
    }

    if (action.type !== INIT &&
        action.type !== UPDATE &&
        action.type !== rehydrateInitAction.type &&
        action.type !== rehydrateAction.type &&
        action.type !== rehydrateErrorAction.type &&
        // If rehydrating is requested then don't sync until the saved state was loaded first
        (rehydratedState || !options.rehydrate)) {
      if (options.debugInfo) {
        console.debug('NgrxStoreIdb: Try to persist state into IndexedDB', nextState, action);
      }
      syncStateUpdate(nextState, action, options, idbStore, service);
    }

    if (options.debugInfo) {
      console.groupEnd();
    }

    return nextState;
  };
};

export const optionsFactory = (options: Partial<NgrxStoreIdbOptions>) => {
  if (options.keys && (options.unmarshaller || options.marshaller)) {
    throw new Error('NgrxStoreIdb: define keys or unmarshaller+marshaller but not both!');
  }
  if (!!options.marshaller !== !!options.unmarshaller) {
    throw new Error('NgrxStoreIdb: define unmarshaller and marshaller!');
  }
  const opts = deepmerge(DEFAULT_OPTS, options);
  if (opts.debugInfo) {
    console.info('NgrxStoreIdbModule: Using the following options', {
      ...opts,
      marshaller: opts.marshaller === defaultMarshaller ? 'default marshaller' : 'custom marshaller',
      unmarshaller: opts.unmarshaller === defaultUnmarshaller ? 'default unmarshaller' : 'custom unmarshaller',
    });
  }
  return opts;
};

export const idbStoreFactory = (opts: NgrxStoreIdbOptions) => {
  return new Store(opts.idb.dbName, opts.idb.storeName);
};

export const ngrxStoreIdbServiceInitializer = (opts: NgrxStoreIdbOptions, service: NgrxStoreIdbService) => {
  return (): Promise<boolean> => {
    return service.onLockAcquired().toPromise().then(hasLock => new Promise((resolve, reject) => {
      if (hasLock || !opts.concurrency.failInitialisationIfNoLock) {
        resolve(true);
      } else {
        reject('Can not acquire master lock. Another tab/window is open?');
      }
    }));
  };
}

import { ActionReducer, INIT, MetaReducer } from '@ngrx/store';
import * as deepmerge from 'deepmerge';
import { set, Store } from 'idb-keyval';
import { KeyConfiguration, Keys, NgrxStoreIdbOptions, SAVED_STATE_KEY } from './ngrx-store-idb.options';
import { rehydrateAction, RehydrateActionPayload, rehydrateErrorAction, rehydrateInitAction } from './rehydrate.actions';

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

export const defaultErrorHandler = (err) => console.error(err);

export const DEFAULT_OPTS: NgrxStoreIdbOptions = {
  rehydrate: true,
  saveOnChange: true,
  syncCondition: null,
  keys: null,
  unmarshaller: defaultUnmarshaller,
  marshaller: defaultMarshaller,
  onError: defaultErrorHandler,
  debugInfo: true,
  idb: {
    dbName: 'NgrxStoreIdb',
    storeName: 'Store',
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
const syncStateUpdate = (state, action, opts: NgrxStoreIdbOptions, idbStore: Store) => {
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
      if (opts.debugInfo) {
        console.debug('NgrxStoreIdb: Store state persisted to IndexedDB', marshalledState, action);
      }
    })
    .catch(err => {
      if (opts.debugInfo) {
        console.error('NgrxStoreIdb: Error storing state to IndexedDB', err, action);
      }
      opts.onError(err);
    });
};

/**
 * This is the main factory that creates our metareducer.
 */

export const metaReducerFactoryWithOptions = (options: NgrxStoreIdbOptions, idbStore: Store) => {
  let rootStateRehydrated = false;
  return (reducer: ActionReducer<any>) => (state: any, action) => {
    let nextState: any;

    if (options.debugInfo) {
      console.group('NgrxStoreIdb: metareducer', state, action);
    }

    // If we are processing rehydrateAction then merge current state with rehydrated state.
    // There is no other reducer for this action.
    if (action.type === rehydrateAction.type) {
      const payload = action as any as RehydrateActionPayload;
      if (payload.rootInit) {
        rootStateRehydrated = true;
      }
      if (!payload.rehydratedState) {
        if (options.debugInfo) {
          console.debug('NgrxStoreIdb: Rehydrated state is empty - nothing to rehydrate.');
          console.groupEnd();
        }
        return state;
      }

      // Merge the store state with the rehydrated state using
      // either a user-defined reducer or the default.
      nextState = options.unmarshaller(state, payload.rehydratedState);
      if (options.debugInfo) {
        console.debug('NgrxStoreIdb: After rehydrating current state', nextState);
      }
    } else {
      nextState = reducer(state, action);
    }

    if (action.type !== INIT &&
        action.type !== rehydrateInitAction.type &&
        action.type !== rehydrateAction.type &&
        action.type !== rehydrateErrorAction.type &&
        // If rehydrating is requested then don't sync until the saved state was loaded first
        (rootStateRehydrated || !options.rehydrate)) {
      if (options.debugInfo) {
        console.debug('NgrxStoreIdb: Persist state into IndexedDB', nextState, action);
      }
      syncStateUpdate(nextState, action, options, idbStore);
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
    onError: opts.onError === defaultErrorHandler ? 'default error handler' : 'custom error handler',
    });
  }
  return opts;
};

export const idbStoreFactory = (opts: NgrxStoreIdbOptions) => {
  return new Store(opts.idb.dbName, opts.idb.storeName);
};

import { Inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType, OnInitEffects } from '@ngrx/effects';
import { Action, UPDATE } from '@ngrx/store';
import { get, Store } from 'idb-keyval';
import { from, of } from 'rxjs';
import { catchError, filter, map, mergeMap, tap } from 'rxjs/operators';
import { ErrorCode } from './error-codes';
import { IDB_STORE, NgrxStoreIdbOptions, OPTIONS, SAVED_STATE_KEY } from './ngrx-store-idb.options';
import { rehydrateAction, rehydrateErrorAction, rehydrateInitAction } from './ngrx-store-idb.actions';

@Injectable()
export class RehydrateEffects implements OnInitEffects {

  // State read from IDB
  rehydratedState: any;

  /**
   * This effect is triggered after root store initialisation.
   * This is the very first thing done by NgRx and the best place
   * to load saved data.
   */
  rehydrateOnInit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(rehydrateInitAction),
      mergeMap(action => {
        if (this.options.debugInfo) {
          console.debug('NgrxStoreIdb: Load state from IndexedDB');
        }
        return from(get(SAVED_STATE_KEY, this.idbStore)).pipe(
          tap(value => this.rehydratedState = value),
          tap(value => {
            if (this.options.debugInfo) {
              console.debug('NgrxStoreIdb: Loaded state from IndexedDB:', value);
            }
          }),
          map(value => rehydrateAction({ rootInit: true, rehydratedState: value })),
          catchError(err => {
            if (this.options.debugInfo) {
              console.error('NgrxStoreIdb: Error reading state from IndexedDB', err);
            }
            this.options.onError(ErrorCode.READ_FROM_IDB_FAILED, err);
            return of(rehydrateErrorAction());
          }),
        );
      }),
    ),
  );

  /**
   * UPDATE action is fired after each feature store initialisation.
   * I need to rehydrate each feature store separatelly because they are wiped on initialisation.
   * This might happen later in the application run for lazy modules.
   */
  rehydrateOnUpdate$ = createEffect(() =>
   this.actions$.pipe(
      ofType(UPDATE),
      filter(() => this.options.rehydrate),
      tap(action => {
        if (this.options.debugInfo) {
          console.debug('NgrxStoreIdb: Trigger rehydratation of a feature', action);
        }
      }),
      map(action => rehydrateAction({ rootInit: false, rehydratedState: this.rehydratedState })),
    ),
  );

  constructor(
    private actions$: Actions,
    @Inject(OPTIONS) private options: NgrxStoreIdbOptions,
    @Inject(IDB_STORE) private idbStore: Store,
  ) { }

  ngrxOnInitEffects(): Action {
    if (this.options.rehydrate) {
      return rehydrateInitAction();
    }
  }
}

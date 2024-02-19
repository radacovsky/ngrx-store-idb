import { Inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType, OnInitEffects } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { get, UseStore } from 'idb-keyval';
import { combineLatest, from, of } from 'rxjs';
import { catchError, map, mergeMap, tap } from 'rxjs/operators';
import {
  rehydrateAction,
  rehydrateDoneAction,
  rehydrateErrorAction,
  rehydrateInitAction
} from './ngrx-store-idb.actions';
import { IDB_STORE, NgrxStoreIdbOptions, OPTIONS, SAVED_STATE_KEY, SAVED_VERSION_KEY } from './ngrx-store-idb.options';
import { NgrxStoreIdbService } from './ngrx-store-idb.service';

@Injectable({
  providedIn: 'root',
})
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
        return combineLatest([from(get(SAVED_STATE_KEY, this.idbStore)), from(get(SAVED_VERSION_KEY, this.idbStore))]).pipe(
          map(([value, version]) => {
            if (version === this.options.version || (version === undefined && this.options.version === 0)) {
              console.debug('NgrxStoreIdb: version matched.');
              return value;
            }

            if (this.options.debugInfo) {
              console.debug('NgrxStoreIdb: Saved state version does not match current version.');
            }

            if (this.options.migrate) {
              if (this.options.debugInfo) {
                console.debug('NgrxStoreIdb: Migrating saved state.');
              }

              return this.options.migrate(value, version);
            }

            if (this.options.debugInfo) {
              console.debug('NgrxStoreIdb: Discard saved state since there is no migration function.');
            }

            return {};
          }),
          tap(value => this.rehydratedState = value),
          tap(value => {
            if (this.options.debugInfo) {
              console.debug('NgrxStoreIdb: Loaded state from IndexedDB:', value);
            }
          }),
          map(value => {
            return rehydrateAction({ rehydratedState: value });
          }),
          catchError(err => {
            console.error('NgrxStoreIdb: Error reading state from IndexedDB', err);
            return of(rehydrateErrorAction());
          }),
        );
      }),
    ),
  );

  /**
   * This effect is triggered after root store initialisation is successfully completed.
   * It is used to dispatch sync effect of rehydration done
   */
  rehydrateDoneOnRehydrate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(rehydrateAction),
      map(() => rehydrateDoneAction())
    ),
  );

  /**
   * This effect is triggered after root store initialisation is completed with failure.
   * It is used to dispatch sync effect of rehydration done
   */
  rehydrateDoneOnRehydrateError$ = createEffect(() =>
    this.actions$.pipe(
      ofType(rehydrateErrorAction),
      map(() => rehydrateDoneAction())
    )
  );

  /**
   * This effect is triggered after root store initialisation is done to broadcast sync event.
   */
  broadcastSyncEventOnRehydrateDone$ = createEffect(() =>
    this.actions$.pipe(
      ofType(rehydrateDoneAction),
      tap(() => this.service.broadcastSyncEvent(rehydrateDoneAction, true))
    ), {dispatch: false}
  );

  constructor(
    private actions$: Actions,
    @Inject(OPTIONS) private options: NgrxStoreIdbOptions,
    @Inject(IDB_STORE) private idbStore: UseStore,
    private service: NgrxStoreIdbService
  ) { }

  ngrxOnInitEffects(): Action {
    if (this.options.rehydrate) {
      return rehydrateInitAction();
    }
  }
}

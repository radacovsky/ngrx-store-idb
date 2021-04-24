import { Inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType, OnInitEffects } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { get, UseStore } from 'idb-keyval';
import { from, of } from 'rxjs';
import { catchError, map, mergeMap, tap } from 'rxjs/operators';
import { rehydrateAction, rehydrateErrorAction, rehydrateInitAction } from './ngrx-store-idb.actions';
import { IDB_STORE, NgrxStoreIdbOptions, OPTIONS, SAVED_STATE_KEY } from './ngrx-store-idb.options';

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
        return from(get(SAVED_STATE_KEY, this.idbStore)).pipe(
          tap(value => this.rehydratedState = value),
          tap(value => {
            if (this.options.debugInfo) {
              console.debug('NgrxStoreIdb: Loaded state from IndexedDB:', value);
            }
          }),
          map(value => rehydrateAction({ rehydratedState: value })),
          catchError(err => {
            console.error('NgrxStoreIdb: Error reading state from IndexedDB', err);
            return of(rehydrateErrorAction());
          }),
        );
      }),
    ),
  );

  constructor(
    private actions$: Actions,
    @Inject(OPTIONS) private options: NgrxStoreIdbOptions,
    @Inject(IDB_STORE) private idbStore: UseStore,
  ) { }

  ngrxOnInitEffects(): Action {
    if (this.options.rehydrate) {
      return rehydrateInitAction();
    }
  }
}

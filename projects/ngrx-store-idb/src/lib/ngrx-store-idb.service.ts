import { Inject, Injectable } from '@angular/core';
import { Action } from '@ngrx/store';
import { get, set, UseStore } from 'idb-keyval';
import { EMPTY, from, Observable, ReplaySubject, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { IDB_STORE, NgrxStoreIdbOptions, OPTIONS } from './ngrx-store-idb.options';

interface ConcurrencyTimestamp {
  uniqueKey: string;
  timestamp: number;
}

export interface NgrxStoreIdbSyncEvent {
  action: Action;
  success: boolean;
}

/**
 * This service emits events each time NgrxStoreIdb metareducer successfuly
 * syncs data to IndexedDB. The data emited from onSync$ observable is
 * the action that triggered the synchronisation event.
 */
@Injectable({
  providedIn: 'root',
})
export class NgrxStoreIdbService {

  private uniqueKey: string;

  private broadcastSubject = new ReplaySubject<Action>(1);

  private onSync$ = this.broadcastSubject.asObservable();

  private lockAcquiredSubject = new ReplaySubject<boolean>(1);

  private onLockAcquired$ = this.lockAcquiredSubject.asObservable();

  private iAmMasterOfStore = false;

  constructor(
    @Inject(OPTIONS) private opts: NgrxStoreIdbOptions,
    @Inject(IDB_STORE) private idbStore: UseStore,
  ) {
    this.uniqueKey = this.uuidv4();

    // Have a look if there is already some other instance running
    from(get<ConcurrencyTimestamp>(this.opts.concurrency.trackKey, this.idbStore)).pipe(
      map(inData => !inData || inData.timestamp < (Date.now() - opts.concurrency.refreshRate * 1.1)),
      switchMap(lockAcquired => {
        if (lockAcquired) {
          this.iAmMasterOfStore = true;
          this.lockAcquiredSubject.next(true);
          this.lockAcquiredSubject.complete();
          // No instance or it was not updated for a long time.
          // Start a timer and keep updating the timestamp
          return timer(0, opts.concurrency.refreshRate).pipe(
            map(() => <ConcurrencyTimestamp>{
              uniqueKey: this.uniqueKey,
              timestamp: Date.now(),
            }),
            switchMap(outData => from(set(this.opts.concurrency.trackKey, outData, this.idbStore)).pipe(map(() => outData)),
          ));
        }
        // Otherwise do nothing - some other instance is syncing/master of the IDB store
        this.lockAcquiredSubject.next(false);
        this.lockAcquiredSubject.complete();
        return EMPTY;
      }),
    ).subscribe(outData => {
      if (opts.debugInfo) {
        console.debug(`NgrxStoreIdb: Updating concurrency timestamp '${opts.concurrency.trackKey}'`, outData);
      }
    });
  }

  public onLockAcquired(): Observable<boolean> {
    return this.onLockAcquired$;
  }

  public canConcurrentlySync(): boolean {
    return this.opts.concurrency.allowed || this.iAmMasterOfStore;
  }

  private uuidv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  broadcastSyncEvent(action: Action, success: boolean): void {
    this.broadcastSubject.next(action);
  }

  public onSync(): Observable<Action> {
    return this.onSync$;
  }
}

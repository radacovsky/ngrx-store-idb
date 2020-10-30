import { Injectable } from '@angular/core';
import { Action } from '@ngrx/store';
import { Observable, ReplaySubject, Subject } from 'rxjs';

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
  providedIn: 'root'
})
export class NgrxStoreIdbService {

  private subject = new ReplaySubject<Action>(1);

  private onSync$ = this.subject.asObservable();

  constructor() {}

  broadcastSyncEvent(action: Action, success: boolean): void {
    this.subject.next(action);
  }

  public onSync(): Observable<Action> {
    return this.onSync$;
  }
}

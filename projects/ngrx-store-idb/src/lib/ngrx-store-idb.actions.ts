import { createAction, props } from '@ngrx/store';

export interface RehydrateActionPayload {
  rehydratedState: any;
}

export const rehydrateInitAction = createAction('NgrxStoreIdb/Init');
export const rehydrateAction = createAction('NgrxStoreIdb/Rehydrate', props<RehydrateActionPayload>());
export const rehydrateErrorAction = createAction('NgrxStoreIdb/RehydrateError');
export const rehydrateDoneAction = createAction('NgrxStoreIdb/RehydrateDone');

import { createAction, props } from '@ngrx/store';

export interface RehydrateActionPayload {
  rootInit: boolean;
  rehydratedState: any;
}

export const rehydrateInitAction = createAction('NgrxStoreIdb/Init');
export const rehydrateAction = createAction('NgrxStoreIdb/Rehydrate', props<RehydrateActionPayload>());
export const rehydrateErrorAction = createAction('NgrxStoreIdb/RehydrateError');

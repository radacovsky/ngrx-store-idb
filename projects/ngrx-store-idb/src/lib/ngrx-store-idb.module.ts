import { APP_INITIALIZER, ModuleWithProviders, NgModule, Optional, SkipSelf } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import { META_REDUCERS } from '@ngrx/store';
import { idbStoreFactory, metaReducerFactoryWithOptions, ngrxStoreIdbServiceInitializer, optionsFactory } from './ngrx-store-idb.metareducer';
import { IDB_STORE, NgrxStoreIdbOptions, OPTIONS } from './ngrx-store-idb.options';
import { RehydrateEffects } from './ngrx-store-idb.effects';
import { NgrxStoreIdbService } from './ngrx-store-idb.service';


/**
 * Import this module in your AppModule using forRoot() method to
 * enable synchronisation of redux store with IndexedDB.
 */
@NgModule({
  declarations: [],
  imports: [
    EffectsModule.forFeature([RehydrateEffects]),
  ],
  exports: [],
})
export class NgrxStoreIdbModule {

  constructor(@Optional() @SkipSelf() parentModule?: NgrxStoreIdbModule) {
    if (parentModule) {
      throw new Error(
        'NgrxStoreIdbModule is already loaded. Import it in the AppModule only');
    }
  }

  static forRoot(options: Partial<NgrxStoreIdbOptions> = {}): ModuleWithProviders<NgrxStoreIdbModule> {
    return {
      ngModule: NgrxStoreIdbModule,
      providers: [
        // Used to pass options into RehydrateEffects
        {
          provide: OPTIONS,
          useValue: optionsFactory(options),
        },
        // Used to pass idb store into RehydrateEffects
        {
          provide: IDB_STORE,
          deps: [OPTIONS],
          useFactory: idbStoreFactory,
        },
        {
          provide: APP_INITIALIZER,
          deps: [OPTIONS, NgrxStoreIdbService],
          useFactory: ngrxStoreIdbServiceInitializer,
          multi: true,
        },
        // This installs NgrxStateIdb metareducer into use
        {
          provide: META_REDUCERS,
          deps: [OPTIONS, IDB_STORE, NgrxStoreIdbService],
          useFactory: metaReducerFactoryWithOptions,
          multi: true,
        },
      ],
    };
  }
}

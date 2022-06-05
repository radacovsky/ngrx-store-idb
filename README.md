# ngrx-store-idb

Simple syncing between your ngrx store and IndexedDB. This library was adapted from excellent [ngrx-store-localstorage](https://github.com/btroncone/ngrx-store-localstorage) library.

## Description

This library is intended for projects implemented with Angular and NGRX. It saves (selected parts of) your store into IndexedDB and again reads them back upon your application load. This is acomplished by installing NGRX metareducer.

The main difference to [ngrx-store-localstorage](https://github.com/btroncone/ngrx-store-localstorage) library is that this library uses IndexedDB for storage.

Local storage can store only 5MB of data, can store only strings and is synchronous.

IndexedDB uses [Structured Cloning Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) to serialize the data, is asynchronous and has much higher [storage limit](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Browser_storage_limits_and_eviction_criteria#Storage_limits).

The data from storage is first read and merged into NGRX store immediatelly after NGRX store is initialized and NGRX effects are activated. There are additional merges executed when a new store feature is activated (e.g. for lazy loaded module).

## Concurrency issues

Since your users can open your web application in multiple tabs or windows it can present interesting challenges to design of your application. If there are multiple instances of your application open at the same time, they fight for access to IndexedDB and will overwrite the data. This might not be a problem if you design for it but usually it will be a problem.

The library supports measures to handle concurrency issues. Each application (running this library) instance will try to acquire a so called lock over IndexedDB store and then will periodically update it to signal that it is still using it. If another instance opens, it will discover that it can not acquire the lock and will either stop syncing state to IndexedDB (but will still be able to rehydrate state) or will fail to load. See `concurrency` options.

If your application needs to synchronise state across multiple tabs/windows then you are better off using [ngrx-store-localstorage](https://github.com/btroncone/ngrx-store-localstorage) library. Local storage supports event notification when the state changes allowing you to react to changes easily.

## Dependencies

`ngrx-store-idb` depends on 
[@ngrx/store](https://github.com/ngrx/store),
[Angular 2+](https://github.com/angular/angular),
[idb-keyval](https://github.com/jakearchibald/idb-keyval)

## Usage

```bash
npm install ngrx-store-idb --save
```

1. Import NgrxStoreIdbModule in your main AppModule.
2. Profit!

```ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NgrxStoreIdbModule } from 'ngrx-store-idb';

@NgModule({
  imports: [
    BrowserModule,
    NgrxStoreIdbModule.forRoot()
  ]
})
export class MyAppModule {}
```

## API

### `NgrxStoreIdbModule.forRoot(options: NgrxStoreIdbOptions)`

Install module that bootstraps NGRX metareducer and registers additional NGRX effects and Angular service.

#### Arguments

* `options` An object that matches with the `NgrxStoreIdbOptions` interface. Uses default values when not provided.

### **NgrxStoreIdbOptions**

An interface defining the configuration attributes to bootstrap NGRX metareducer. The following are properties which compose `NgrxStoreIdbOptions`:
* `keys` State keys/slices to sync with IndexedDB. The keys can be defined in two different formats:
    * `string[]`: Array of strings representing the state (reducer) keys. Full state will be synced (e.g. `NgrxStoreIdbModule.forRoot({keys: ['todos']})`).

    * `object[]`: Array of objects where for each object the key represents the state slice and the value represents properties of given slice which should be synced. This allows for the partial state sync (e.g. `NgrxStoreIdbModule.forRoot({keys: [{todos: ['name', 'status'] }, ... ]})`).
Default value is null (i.e. not used). Can not be used together with `unmarshaller/marshaller` options.

* `rehydrate: boolean`: Pull initial state from IndexedDB on startup, this will default to `true`.

* `saveOnChange: boolean`: If `true` then state will be synced to IndexedDB only if it differs from previous synced value. It uses object equality to compare previous and current state. See `\projects\ngrx-store-idb\src\lib\ngrx-store-idb.metareducer.ts#statesAreEqual()` for details of the comparison algorithm. Default value is `true`.

* `syncCondition: (state: any, action: Action) => boolean`: Custom comparator used to determine if the current state should be synced to IndexedDB. You can use it to e.g. implement your own state comparison or trigger synchronisation only for certain actions. Default is `null`.

* `unmarshaller: (state: any, rehydratedState: any) => any`: Defines the reducer to use to merge the rehydrated state from storage with the state from the ngrx store. Must be defined together with `marshaller`. Can not be used together with `keys`. If unspecified, defaults to performing a full [deepmerge](https://github.com/TehShrike/deepmerge).

* `marshaller: (state: any) => any`: Method used to marshall store state to be written into IndexedDB. Must be used together with `unmarshaller`. Can not be used together with `keys`. Default marshaller saves to whole state.

* `debugInfo: boolean`: Set to true to see debug messages in console. It can help you to understand when and how is state synced. Default is `true`.

* `concurrency.allowed: boolean`: If false then library won't sync state to IndexedDB if it detects that another instance of Window/Tab is already syncing. Default is false.

* `concurrency.refreshRate: number`: Time in ms how often library updates timestamp. This shouldn't be less than 1000ms. Default is 5000ms.

* `concurrency.trackKey: string`: Name of IndexedDB key that holds the timestamp data. Default is 'ConcurrencyTimestamp'.

* `concurrency.failInitialisationIfNoLock: boolean`: If the library detects that another instance of application already exists (e.g. running in different tab/window) and this is set to true then application won't start up. Default is false.

* `idb.dbName`: IndexedDB database name. Use it if your application already uses IndexedDB and you want to keep everything together. Default value is `NgrxStoreIdb`.

* `idb.storeName`: IndexedDb store name. Use it if your application already uses IndexedDB and you want to keep everything together. Default value is `Store`.

### `NgrxStoreIdbService`

This service broadcasts information every time ngrx-store-idb syncs store to IndexedDB. 

#### `onSync(): Observable<NgrxStoreIdbSyncEvent>`

Subscribe to observable returned by this method to receive `NgrxStoreIdbSyncEvent` events every time when store is synced.
These are properties of `NgrxStoreIdbSyncEvent`:

* `success: boolean`: indicates if synchronisation was successful. Falsy value means that data wasn't written.

* `action: Action`: holds the action that triggered the synchronisation. You could use this to wait for synchronisation after some user action e.g. wait until store is synchronised after logout to close the page.

#### `onLockAcquired(): Observable<boolean>`

Subscribe to observable returned by this method to receive information whether current instance was able to acquire lock. If the value returned is true then current instance of application is the one that will sync its state to IndexedDB. False means that some other instance is already running.

#### `canConcurrentlySync(): boolean`

Retuns true if current instance has lock or if the concurrency configuration allows concurrent instances to update IndexedDB (`concurrency.allowed = true`).

### Usage

#### Target Depth Configuration

```ts
NgrxStoreIdbModule.forRoot({
  keys: [
      { feature1: [{ slice11: ['slice11_1'], slice14: ['slice14_2'] }] }, 
      { feature2: ['slice21'] }
  ],
});
```
In this example, `feature1.slice11.slice11_1`, `feature1.slice14.slice14_2`, and `feature2.slice21` will be synced to IndexedDB.

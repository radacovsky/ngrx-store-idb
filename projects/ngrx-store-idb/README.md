# ngrx-store-idb

Simple syncing between your ngrx store and IndexedDB. This library was adapted from excellent [ngrx-store-localstorage](https://github.com/btroncone/ngrx-store-localstorage) library.

## Description

This library is intended for projects implemented with Angular and NGRX. It saves (selected parts of) your store into IndexedDB and again reads them back upon your application load. This is acomplished by installing NGRX metareducer.

The main difference to [ngrx-store-localstorage](https://github.com/btroncone/ngrx-store-localstorage) library is that this library uses IndexedDB for storage.

Local storage can store only 5MB of data, can store only strings and is synchronous.

IndexedDB uses [Structured Cloning Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) to serialize the data, is asynchronous and has much higher [storage limit](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Browser_storage_limits_and_eviction_criteria#Storage_limits).

The data from storage is first read and merged into NGRX store immediatelly after NGRX store is initialized and NGRX effects are activated. There are additional merges executed when a new store feature is activated (e.g. for lazy loaded module).

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
import { NgrxStoreIdbModule } from 'mgrx-store-idb';

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

* `idb.dbName`: IndexedDB database name. Use it is your application already uses IndexedDB and you want to keep everything together. Default value is `NgrxStoreIdb`.

* `idb.storeName`: IndexedDb store name. Use it is your application already uses IndexedDB and you want to keep everything together. Default value is `Store`.

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
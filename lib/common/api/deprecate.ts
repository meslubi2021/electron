type DeprecationHandler = (message: string) => void;

let deprecationHandler: DeprecationHandler | null = null;

function warnOnce (oldName: string, newName?: string) {
  return warnOnceMessage(newName
    ? `'${oldName}' is deprecated and will be removed. Please use '${newName}' instead.`
    : `'${oldName}' is deprecated and will be removed.`);
}

function warnOnceMessage (msg: string) {
  let warned = false;
  return () => {
    if (!warned && !process.noDeprecation) {
      warned = true;
      log(msg);
    }
  };
}

function setHandler (handler: DeprecationHandler | null): void {
  deprecationHandler = handler;
}

function getHandler (): DeprecationHandler | null {
  return deprecationHandler;
}

function warn (oldName: string, newName: string): void {
  if (!process.noDeprecation) {
    log(`'${oldName}' is deprecated. Use '${newName}' instead.`);
  }
}

function log (message: string): void {
  if (typeof deprecationHandler === 'function') {
    deprecationHandler(message);
  } else if (process.throwDeprecation) {
    throw new Error(message);
  } else if (process.traceDeprecation) {
    return console.trace(message);
  } else {
    return console.warn(`(electron) ${message}`);
  }
}

// remove a function with no replacement
function removeFunction<T extends Function> (fn: T, removedName: string): T {
  if (!fn) { throw new Error(`'${removedName} function' is invalid or does not exist.`); }

  // wrap the deprecated function to warn user
  const warn = warnOnce(`${fn.name} function`);
  return function (this: any) {
    warn();
    fn.apply(this, arguments);
  } as unknown as typeof fn;
}

// change the name of a function
function renameFunction<T extends Function> (fn: T, newName: string): T {
  const warn = warnOnce(`${fn.name} function`, `${newName} function`);
  return function (this: any) {
    warn();
    return fn.apply(this, arguments);
  } as unknown as typeof fn;
}

// change the name of an event
function event (emitter: NodeJS.EventEmitter, oldName: string, newName: string, transformer: (...args: any[]) => any[] | undefined = (...args) => args) {
  const warn = newName.startsWith('-') /* internal event */
    ? warnOnce(`${oldName} event`)
    : warnOnce(`${oldName} event`, `${newName} event`);
  return emitter.on(newName, function (this: NodeJS.EventEmitter, ...args) {
    if (this.listenerCount(oldName) !== 0) {
      warn();
      const transformedArgs = transformer(...args);
      if (transformedArgs) {
        this.emit(oldName, ...transformedArgs);
      }
    }
  });
}

// remove a property with no replacement
function removeProperty<T extends Object, K extends (keyof T & string)>(object: T, removedName: K, onlyForValues?: any[]): T {
  // if the property's already been removed, warn about it
  // eslint-disable-next-line no-proto
  const info = Object.getOwnPropertyDescriptor((object as any).__proto__, removedName);
  if (!info) {
    log(`Unable to remove property '${removedName}' from an object that lacks it.`);
    return object;
  }
  if (!info.get || !info.set) {
    log(`Unable to remove property '${removedName}' from an object does not have a getter / setter`);
    return object;
  }

  // wrap the deprecated property in an accessor to warn
  const warn = warnOnce(removedName);
  return Object.defineProperty(object, removedName, {
    configurable: true,
    get: () => {
      warn();
      return info.get!.call(object);
    },
    set: newVal => {
      if (!onlyForValues || onlyForValues.includes(newVal)) {
        warn();
      }
      return info.set!.call(object, newVal);
    }
  });
}

// change the name of a property
function renameProperty<T extends Object, K extends (keyof T & string)>(object: T, oldName: string, newName: K): T {
  const warn = warnOnce(oldName, newName);

  // if the new property isn't there yet,
  // inject it and warn about it
  if ((oldName in object) && !(newName in object)) {
    warn();
    object[newName] = (object as any)[oldName];
  }

  // wrap the deprecated property in an accessor to warn
  // and redirect to the new property
  return Object.defineProperty(object, oldName, {
    get: () => {
      warn();
      return object[newName];
    },
    set: value => {
      warn();
      object[newName] = value;
    }
  });
}

function moveAPI<T extends Function> (fn: T, oldUsage: string, newUsage: string): T {
  const warn = warnOnce(oldUsage, newUsage);
  return function (this: any) {
    warn();
    return fn.apply(this, arguments);
  } as unknown as typeof fn;
}

const deprecate: ElectronInternal.DeprecationUtil = {
  warnOnce,
  warnOnceMessage,
  setHandler,
  getHandler,
  warn,
  log,
  removeFunction,
  renameFunction,
  event,
  removeProperty,
  renameProperty,
  moveAPI
};

export default deprecate;

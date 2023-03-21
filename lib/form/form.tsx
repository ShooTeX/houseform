import {
  ForwardedRef,
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ZodError } from "zod";
import { fillPath, getValidationError, stringToPath, validate } from "../utils";
import { FieldInstance } from "../field";
import { FieldArrayInstance } from "../field-array";
import { FormInstance } from "./types";
import { FormContext } from "./context";

export interface FormProps<T> {
  onSubmit?: (values: T, form: FormInstance<T>) => void;
  children: (props: FormInstance<T>) => JSX.Element;
  memoChild?: any[];
  submitWhenInvalid?: boolean;
}

function FormComp<T extends Record<string, any> = Record<string, any>>(
  props: FormProps<T>,
  ref: ForwardedRef<FormInstance<T>>
) {
  const { onSubmit, children, memoChild, submitWhenInvalid = false } = props;

  const formFieldsRef = useRef<
    Array<FieldInstance<any, T> | FieldArrayInstance<any, T>>
  >([]);

  const [isSubmitted, setIsSubmitted] = useState(false);

  const getFieldValue = useCallback(
    (name: string) => {
      const found = formFieldsRef.current.find(
        (field) => field.props.name === name
      );
      if (found) return found;
      const normalizedName = stringToPath(name).join(".");
      return formFieldsRef.current.find(
        (field) => field._normalizedDotName === normalizedName
      );
    },
    [formFieldsRef]
  ) as FormInstance<T>["getFieldValue"];

  const onChangeListenerRefs = useRef({} as Record<string, (() => void)[]>);
  const onBlurListenerRefs = useRef({} as Record<string, (() => void)[]>);
  const onMountListenerRefs = useRef({} as Record<string, (() => void)[]>);

  const setIsTouched = useCallback((val: boolean) => {
    formFieldsRef.current.forEach((field) => {
      field.setIsTouched(val);
    });
  }, []);

  const setIsDirty = useCallback((val: boolean) => {
    formFieldsRef.current.forEach((field) => {
      field.setIsDirty(val);
    });
  }, []);

  const [_errors, _setErrors] = useState<string[] | null>(null);
  const [_isValid, _setIsValid] = useState<boolean | null>(null);
  const [_isDirty, _setIsDirty] = useState<boolean | null>(null);
  const [_isTouched, _setIsTouched] = useState<boolean | null>(null);

  const shouldRerenderErrorOnRecompute = useRef(false);

  const shouldRerenderIsValidOnRecompute = useRef(false);

  const shouldRerenderIsDirtyOnRecompute = useRef(false);

  const shouldRerenderIsTouchedOnRecompute = useRef(false);

  const getErrors = useCallback(() => {
    return formFieldsRef.current.reduce((acc, field) => {
      return acc.concat(field.errors);
    }, [] as string[]);
  }, [formFieldsRef]);

  const getValidBoolean = useCallback(() => {
    if (formFieldsRef.current.length === 0) return true;
    return formFieldsRef.current.every((field) => {
      return field.errors.length === 0;
    });
  }, [formFieldsRef]);

  const getFieldBoolean = useCallback(
    (
      booleanFieldName: keyof (
        | FieldInstance<any, T>
        | FieldArrayInstance<any, T>
      )
    ) => {
      return formFieldsRef.current.some((field) => {
        return !!field[booleanFieldName];
      });
    },
    [formFieldsRef]
  );

  const recomputeErrors = useCallback(() => {
    if (shouldRerenderErrorOnRecompute.current) {
      const val = getErrors();
      _setErrors(val);
    }
    if (shouldRerenderIsValidOnRecompute.current) {
      const val = getValidBoolean();
      _setIsValid(val);
    }
  }, [getErrors, getValidBoolean]);

  const recomputeIsDirty = useCallback(() => {
    if (shouldRerenderIsDirtyOnRecompute.current) {
      const val = getFieldBoolean("isDirty");
      _setIsDirty(val);
    }
  }, [getFieldBoolean]);

  const recomputeIsTouched = useCallback(() => {
    if (shouldRerenderIsTouchedOnRecompute.current) {
      const val = getFieldBoolean("isTouched");
      _setIsTouched(val);
    }
  }, [getFieldBoolean]);

  const errorGetter = useCallback(() => {
    shouldRerenderErrorOnRecompute.current = true;
    if (_errors === null) {
      const val = getErrors();
      _setErrors(val);
      return val;
    }
    return _errors;
  }, [_errors, getErrors]);

  const isValidGetter = useCallback(() => {
    shouldRerenderIsValidOnRecompute.current = true;
    if (_isValid === null) {
      const val = getValidBoolean();
      _setIsValid(val);
      return val;
    }
    return _isValid;
  }, [_isValid, getValidBoolean]);

  const isDirtyGetter = useCallback(() => {
    if (_isDirty === null) {
      shouldRerenderIsDirtyOnRecompute.current = true;
      const val = getFieldBoolean("isDirty");
      _setIsDirty(val);
      return val;
    }
    return _isDirty;
  }, [_isDirty, getFieldBoolean]);

  const isTouchedGetter = useCallback(() => {
    if (_isTouched === null) {
      shouldRerenderIsTouchedOnRecompute.current = true;
      const val = getFieldBoolean("isTouched");
      _setIsTouched(val);
      return val;
    }
    return _isTouched;
  }, [_isTouched, getFieldBoolean]);

  const reset = useCallback(() => {
    formFieldsRef.current.forEach((field) => {
      const value = field.props.resetWithValue || field.props.initialValue;

      if (Array.isArray(field.value)) {
        (field as FieldArrayInstance).setValues(value || []);
      } else {
        (field as FieldInstance).setValue(value || "");
      }
    });
    _setIsDirty(false);
    _setIsTouched(false);
    _setErrors(null);
  }, [_setIsTouched, _setIsDirty, _setErrors]);

  const baseValue = useMemo(() => {
    return {
      getFieldValue,
      onChangeListenerRefs,
      onBlurListenerRefs,
      onMountListenerRefs,
      isSubmitted,
      setIsSubmitted,
      formFieldsRef,
      setIsTouched,
      setIsDirty,
      recomputeErrors,
      recomputeIsDirty,
      recomputeIsTouched,
      reset,
      get errors() {
        return errorGetter();
      },
      get isValid() {
        return isValidGetter();
      },
      get isDirty() {
        return isDirtyGetter();
      },
      get isTouched() {
        return isTouchedGetter();
      },
      submit: () => Promise.resolve(true),
    };
  }, [
    getFieldValue,
    isSubmitted,
    setIsTouched,
    setIsDirty,
    recomputeErrors,
    recomputeIsDirty,
    recomputeIsTouched,
    errorGetter,
    isValidGetter,
    isDirtyGetter,
    isTouchedGetter,
    reset,
  ]);

  const submit = useCallback(async () => {
    setIsSubmitted(true);
    const values = {} as T;

    const validArrays = await Promise.all(
      formFieldsRef.current.map(async (formField) => {
        const runValidationType = async (
          type: "onChangeValidate" | "onSubmitValidate" | "onBlurValidate"
        ) => {
          if (!formField.props[type as "onChangeValidate"]) return true;
          try {
            await validate(
              formField.value,
              baseValue,
              formField.props[type as "onChangeValidate"]!
            );
            return true;
          } catch (error) {
            formField.setErrors(getValidationError(error as ZodError | string));
            return false;
          }
        };
        const onChangeRes = await runValidationType("onChangeValidate");
        if (!onChangeRes) return false;
        const onBlurRes = await runValidationType("onBlurValidate");
        if (!onBlurRes) return false;
        const onSubmitRes = await runValidationType("onSubmitValidate");
        if (!onSubmitRes) return false;
        if (formField.errors.length > 0) return false;
        fillPath(values, formField.props.name, formField.value);
        return true;
      })
    );

    if (!submitWhenInvalid) {
      if (!validArrays.every((isValid) => !!isValid)) {
        return false;
      }
    }

    // TODO: Add tests to see if it gets cached version of `isDirty`, `isTouched`, `isValid`, and `errors`
    onSubmit?.(values, baseValue);
    return true;
  }, [baseValue, onSubmit, submitWhenInvalid]);

  const value = useMemo(() => {
    const omittedKeysToPick = [
      "errors",
      "isValid",
      "isDirty",
      "isTouched",
      "submit",
      "reset",
    ] as const;
    const val = {
      reset,
      submit,
      get errors() {
        return errorGetter();
      },
      get isValid() {
        return isValidGetter();
      },
      get isDirty() {
        return isDirtyGetter();
      },
      get isTouched() {
        return isTouchedGetter();
      },
    } as any as typeof baseValue;

    // We cannot pick any of the `omittedKeysToPick` keys. This is because they're
    // also getters, which means that we ruin the "only use when needed" logic
    for (const key of Object.keys(baseValue)) {
      if (omittedKeysToPick.includes(key as "errors")) continue;
      const _key = key as Exclude<
        keyof typeof baseValue,
        (typeof omittedKeysToPick)[number]
      >;
      val[_key] = baseValue[_key] as never;
    }

    return val;
  }, [
    reset,
    baseValue,
    errorGetter,
    isDirtyGetter,
    isTouchedGetter,
    isValidGetter,
    submit,
  ]);

  useImperativeHandle(ref, () => value, [value]);

  const memoizedChildren = useMemo(
    () => {
      return children(value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    memoChild ? memoChild.concat(value) : [children, value]
  );

  return (
    <FormContext.Provider value={value}>
      {memoizedChildren}
    </FormContext.Provider>
  );
}

export const Form = memo(forwardRef(FormComp)) as <T = Record<string, any>>(
  props: FormProps<T> & { ref?: ForwardedRef<FormInstance<T>> }
) => ReturnType<typeof FormComp>;

module.export({default:()=>createLucideIcon});let forwardRef,createElement;module.link('react',{forwardRef(v){forwardRef=v},createElement(v){createElement=v}},0);let mergeClasses,toKebabCase;module.link('./shared/src/utils.js',{mergeClasses(v){mergeClasses=v},toKebabCase(v){toKebabCase=v}},1);let Icon;module.link('./Icon.js',{default(v){Icon=v}},2);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */





const createLucideIcon = (iconName, iconNode) => {
  const Component = forwardRef(
    ({ className, ...props }, ref) => createElement(Icon, {
      ref,
      iconNode,
      className: mergeClasses(`lucide-${toKebabCase(iconName)}`, className),
      ...props
    })
  );
  Component.displayName = `${iconName}`;
  return Component;
};


//# sourceMappingURL=createLucideIcon.js.map
